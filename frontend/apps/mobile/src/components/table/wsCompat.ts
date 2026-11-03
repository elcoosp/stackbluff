/**
 * Web-API compat shims for @stackbluff/shared on React Native.
 *
 * The shared `useGameWebSocket` hook (moved from the PWA in task 2-b) still
 * uses two browser globals that React Native does not provide:
 *   1. `window.location.search`        — read once at mount (tournament id)
 *   2. `window.dispatchEvent`/`CustomEvent`/`addEventListener` — used as the
 *      transport for `kickVoteStarted` / `kickVoteUpdate` / `playerRemoved` /
 *      `tournament:*` / `feedback:visual` fan-outs (parseMessage + feedback
 *      controller).
 *
 * This module installs a tiny, idempotent polyfill so the shared code keeps
 * working byte-identically on native, and exposes typed subscribe helpers
 * for the table UI to consume those events.
 *
 * NOTE (A2/A4 REQUEST): the long-term fix is a surface event-bus
 * (`surface.emit/on`) in @stackbluff/shared; see worklog entry 3-a.
 */

type Listener = (event: { detail?: unknown; type?: string }) => void;

interface CompatWindow {
  location?: { search?: string; href?: string };
  dispatchEvent?: (event: { type: string; detail?: unknown }) => boolean;
  addEventListener?: (type: string, listener: Listener) => void;
  removeEventListener?: (type: string, listener: Listener) => void;
  CustomEvent?: new (
    type: string,
    init?: { detail?: unknown },
  ) => {
    type: string;
    detail?: unknown;
  };
}

const listeners = new Map<string, Set<Listener>>();

function ensureWindow(): CompatWindow {
  const g = globalThis as unknown as { window?: CompatWindow };
  if (!g.window) {
    // React Native aliases `window` to globalThis — normalize anyway.
    g.window = g as CompatWindow;
  }
  return g.window;
}

/** Installs the shims once. Safe to call repeatedly (idempotent). */
export function installWsCompat(): void {
  const w = ensureWindow();

  // 1. location — expo-router owns URLs; the shared hook only reads
  //    `?tournamentId=`, which the table route passes via gameStore instead.
  if (!w.location) {
    w.location = { search: '', href: '' };
  }

  // 2. DOM-ish event emitter over a plain Map.
  if (typeof w.dispatchEvent !== 'function') {
    w.dispatchEvent = (event: { type: string; detail?: unknown }) => {
      const set = listeners.get(event.type);
      if (!set) return true;
      for (const listener of [...set]) {
        try {
          listener({ type: event.type, detail: event.detail });
        } catch (e) {
          console.warn(`[wsCompat] listener for '${event.type}' threw`, e);
        }
      }
      return true;
    };
  }
  if (typeof w.addEventListener !== 'function') {
    w.addEventListener = (type: string, listener: Listener) => {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    };
  }
  if (typeof w.removeEventListener !== 'function') {
    w.removeEventListener = (type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener);
    };
  }
  if (typeof w.CustomEvent !== 'function') {
    w.CustomEvent = class CustomEvent {
      type: string;
      detail?: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    } as CompatWindow['CustomEvent'];
  }
}

/** Subscribe to a shared-layer custom event (kick votes, tournament, feedback). */
export function onSharedEvent(type: string, handler: (detail: unknown) => void): () => void {
  installWsCompat();
  const w = ensureWindow();
  const listener: Listener = (event) => handler(event.detail);
  w.addEventListener?.(type, listener);
  return () => w.removeEventListener?.(type, listener);
}

/** Emit on the same bus the shared code dispatches to. */
export function emitSharedEvent(type: string, detail?: unknown): void {
  installWsCompat();
  ensureWindow().dispatchEvent?.({ type, detail });
}

// Auto-install at import time so any shared module that touches `window.*`
// (useGameWebSocket mount effect, feedback controller) finds the shims ready.
installWsCompat();
