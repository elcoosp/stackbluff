#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE="$REPO_ROOT/tools/sbdc"
EXT_DIR="$BASE/sbdc-extension"

echo "=== Diagnosis ==="
echo "The OLD content.ts worked — it found the UI. The NEW one doesn't."
echo "Root cause: I removed all_frames:true and added iframe skip."
echo "Perchance.org loads the generator UI inside an IFRAME."
echo "The content script MUST run in iframes to find the UI."
echo ""

echo "=== Fix 1: Restore all_frames: true in manifest ==="
cat > "$EXT_DIR/manifest.json" << 'MANIFEST_V6_J4kP9'
{
  "manifest_version": 3,
  "name": "SBDC Generator",
  "version": "1.0",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "http://localhost:*/*"
  ],
  "background": {
    "service_worker": "src/background.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.perchance.org/*"
      ],
      "js": [
        "src/content.ts"
      ],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],
  "action": {
    "default_popup": "src/popup.html"
  }
}
MANIFEST_V6_J4kP9
echo "Restored all_frames: true"

echo ""
echo "=== Fix 2: Rewrite content.ts — keep what worked, add logging ==="
echo "The old selectors worked. Using them exactly as before,"
echo "but with the new API flow and debug logging."
echo ""

cat > "$EXT_DIR/src/content.ts" << 'CT_V7_M3nR5'
interface PromptData {
  prompt_id: number;
  target_card: string;
  target_layer: string;
  positive: string;
  negative: string;
  status?: string;
}

interface ImageData {
  index: number;
  data: string;
}

interface StatusData {
  deck_id: string;
  status: string;
  total_prompts: number;
  ready_to_generate: number;
  takes_per_prompt: number;
}

interface FetchResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

interface StorageResult {
  deckId?: string;
  serverUrl?: string;
}

const FRAME_ID = window.location.hostname.substring(0, 40);

function log(m: string): void {
  const line = `[SBDC][${FRAME_ID}] ${m}`;
  console.log(`%c${line}`, "color:#0ff;font-weight:bold;font-size:14px;");
  try {
    const ind = document.getElementById("sbdc-indicator");
    if (ind) ind.textContent = line;
  } catch {
    // ignore
  }
}

function setIndicator(color: string, text: string): void {
  try {
    let ind = document.getElementById("sbdc-indicator");
    if (!ind) {
      ind = document.createElement("div");
      ind.id = "sbdc-indicator";
      ind.style.cssText =
        "position:fixed;top:0;left:0;z-index:999999;color:white;font:bold 14px monospace;padding:8px 12px;pointer-events:none;max-width:100%;white-space:nowrap;";
      (document.body || document.documentElement).appendChild(ind);
    }
    ind.style.background = color;
    ind.textContent = text;
  } catch {
    // ignore
  }
}

async function getServerUrl(): Promise<string> {
  const resp: FetchResponse = await chrome.runtime.sendMessage({ type: "GET_SERVER_URL" });
  const data = resp as { url?: string };
  return data?.url || "http://localhost:8899";
}

async function getDeckId(): Promise<string> {
  const resp: StorageResult = await new Promise((resolve) => {
    chrome.storage.local.get(["deckId"], (res: StorageResult) => resolve(res));
  });
  return resp?.deckId || "";
}

async function serverFetch(urlPath: string, method?: string, body?: string): Promise<unknown> {
  const base = await getServerUrl();
  const url = base + urlPath;
  log(`FETCH ${method || "GET"} ${url}`);
  try {
    const resp: FetchResponse = await chrome.runtime.sendMessage({
      type: "FETCH",
      url,
      method: method || "GET",
      body: body || null,
    });
    if (!resp) throw new Error("No response from background");
    if (!resp.ok) throw new Error(resp.error || "Fetch failed");
    return resp.data;
  } catch (e: Error) {
    log(`FETCH ERROR: ${e.message}`);
    throw e;
  }
}

function fillTextarea(selector: string, value: string): boolean {
  const el = document.querySelector(selector) as HTMLTextAreaElement | null;
  if (!el) return false;
  el.focus();
  el.setSelectionRange(0, el.value.length);
  const ok = document.execCommand("insertText", false, value);
  if (!ok) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return true;
}

async function waitForUI(): Promise<boolean> {
  for (let i = 0; i < 120; i++) {
    const desc = document.querySelector('textarea[data-name="description"]');
    const genBtn = document.querySelector("#generateButtonEl");

    if (i === 0) {
      log(`Scanning UI in ${FRAME_ID}...`);
      log(`  textarea[data-name="description"]: ${desc ? "FOUND" : "not found"}`);
      log(`  #generateButtonEl: ${genBtn ? "FOUND" : "not found"}`);
      log(`  URL: ${window.location.href}`);
      log(`  textareas: ${document.querySelectorAll("textarea").length}`);
      log(`  buttons: ${document.querySelectorAll("button").length}`);
      document.querySelectorAll("textarea").forEach((t, idx) => {
        if (idx < 5) {
          log(`  ta[${idx}]: data-name="${t.getAttribute("data-name")}" id="${t.id}"`);
        }
      });
      document.querySelectorAll("button").forEach((b, idx) => {
        if (idx < 5) {
          log(`  btn[${idx}]: id="${b.id}" text="${b.textContent?.substring(0, 30)}"`);
        }
      });
    }

    if (desc && genBtn) {
      log(`UI found after ${i}s in ${FRAME_ID}`);
      return true;
    }

    if (i % 10 === 0 && i > 0) {
      log(`Waiting for UI... (${i}s)`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  log(`No UI in ${FRAME_ID} — this frame doesn't have the generator`);
  return false;
}

async function runGeneration(): Promise<void> {
  const deckId = await getDeckId();
  if (!deckId) {
    log("No deck ID — open popup to configure");
    setIndicator("orange", "[SBDC] Open popup to configure");
    return;
  }

  log(`Starting generation for deck: ${deckId}`);

  let ready = false;
  while (!ready) {
    try {
      const status = (await serverFetch(`/api/decks/${deckId}/status`)) as StatusData;
      log(`Status: ready=${status.ready_to_generate} status=${status.status}`);

      if (status.ready_to_generate > 0) {
        ready = true;
        setIndicator("green", `[SBDC] ${status.ready_to_generate} prompts!`);
      } else if (status.status === "generating") {
        ready = true;
        setIndicator("green", "[SBDC] Resuming...");
      } else {
        setIndicator("orange", "[SBDC] Click Start in popup!");
      }
    } catch (e: Error) {
      log(`Server unreachable: ${e.message}`);
      setIndicator("darkred", "[SBDC] No server");
    }
    if (!ready) await new Promise((r) => setTimeout(r, 3000));
  }

  const NUM_IMAGES = 4;

  while (true) {
    let item: PromptData | null = null;
    try {
      const data = await serverFetch(`/api/decks/${deckId}/prompts/next`);
      item = data as PromptData;
    } catch (e: Error) {
      log(`Server lost: ${e.message}`);
      setIndicator("darkred", "[SBDC] Server lost");
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    if (item && item.status === "no_more_prompts") {
      setIndicator("orange", "[SBDC] No more prompts");
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    if (!item || !item.prompt_id) {
      log("ALL PROMPTS COMPLETE!");
      setIndicator("blue", "[SBDC] ALL DONE!");
      break;
    }

    log(`prompt_id=${item.prompt_id} card=${item.target_card}/${item.target_layer}`);
    setIndicator("green", `[SBDC] ${item.target_card}/${item.target_layer}`);

    const ns = document.querySelector('select[data-name="numImages"]') as HTMLSelectElement | null;
    if (ns) {
      ns.value = String(NUM_IMAGES);
      ns.dispatchEvent(new Event("change", { bubbles: true }));
    }

    fillTextarea('textarea[data-name="description"]', item.positive);
    const v = document.querySelector('textarea[data-name="description"]') as HTMLTextAreaElement | null;
    log(`Positive: "${v ? v.value.substring(0, 80) : "NULL"}..."`);

    if (item.negative) {
      const neg = document.querySelector('textarea[data-name="negative"]') as HTMLTextAreaElement | null;
      if (neg) {
        const ctn = neg.closest(".input-ctn") as HTMLElement | null;
        if (ctn && ctn.dataset.foldToggleState === "hidden") {
          ctn.dataset.foldToggleState = "shown";
          await new Promise((r) => setTimeout(r, 300));
        }
        fillTextarea('textarea[data-name="negative"]', item.negative);
        log("Negative set.");
      }
    }

    const before = document.querySelectorAll("#outputAreaEl img").length;
    log(`Generating ${NUM_IMAGES} (before: ${before})...`);
    setIndicator("darkgreen", `[SBDC] Generating ${item.target_card}...`);
    document.querySelector("#generateButtonEl")!.click();

    await new Promise<void>((resolve) => {
      const iv = setInterval(() => {
        const imgs = document.querySelectorAll("#outputAreaEl img");
        if (imgs.length >= before + NUM_IMAGES) {
          let allOk = true;
          for (let i = before; i < before + NUM_IMAGES; i++) {
            const img = imgs[i] as HTMLImageElement;
            if (!img.complete || img.naturalHeight === 0) {
              allOk = false;
              break;
            }
          }
          if (allOk) {
            clearInterval(iv);
            resolve();
          }
        }
      }, 1000);
    });
    log("Images loaded!");

    const imgs = document.querySelectorAll("#outputAreaEl img");
    const images: ImageData[] = [];
    for (let i = before; i < before + NUM_IMAGES; i++) {
      const src = (imgs[i] as HTMLImageElement).src;
      if (src.startsWith("data:")) {
        images.push({ index: i - before, data: src });
      } else {
        try {
          const resp = await fetch(src);
          const blob = await resp.blob();
          const data = await new Promise<string>((res) => {
            const rd = new FileReader();
            rd.onload = () => res(rd.result as string);
            rd.readAsDataURL(blob);
          });
          images.push({ index: i - before, data });
        } catch {
          log("Image fetch failed");
        }
      }
    }

    try {
      await serverFetch(
        `/api/decks/${deckId}/prompts/${item.prompt_id}/takes`,
        "POST",
        JSON.stringify({ images }),
      );
      log(`Takes submitted for prompt ${item.prompt_id}`);
    } catch (e: Error) {
      log(`Submit failed: ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
  }
}

async function main(): Promise<void> {
  setIndicator("red", `[SBDC] Script loaded in ${FRAME_ID}`);
  log(`Content script loaded. URL: ${window.location.href}`);

  if (!(await waitForUI())) return;

  setIndicator("green", "[SBDC] UI ready!");
  log("UI ready! Checking server...");

  const deckId = await getDeckId();
  if (deckId) {
    log(`Deck ID: ${deckId}`);
    await runGeneration();
  } else {
    log("No deck ID. Waiting for popup...");
    setIndicator("orange", "[SBDC] Configure in popup");

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.deckId && changes.deckId.newValue) {
        log(`Deck ID set: ${changes.deckId.newValue}`);
        runGeneration().catch((e: Error) => log(`Fatal: ${e.message}`));
      }
    });
  }
}

main().catch((e: Error) => {
  log(`Fatal: ${e.message}`);
});
CT_V7_M3nR5

echo "Rebuilding extension"
rm -rf "$EXT_DIR/dist"
(cd "$EXT_DIR" && bash build.sh 2>&1)

echo ""
echo "Dist contents:"
find "$EXT_DIR/dist" -type f | sort

echo ""
echo "Checking Rust"
cargo clippy --workspace --manifest-path "$BASE/Cargo.toml" -- -D warnings 2>&1 | tail -3

echo ""
echo "Running tests"
cargo test --workspace --manifest-path "$BASE/Cargo.toml" 2>&1 | tail -5

git add -A
git commit -m "fix(sbdc): restore all_frames:true, revert to working selectors

- The perchance.org generator UI lives inside an iframe
- Removing all_frames:true broke UI detection completely
- Revert to original selectors that were known to work:
  textarea[data-name=description], #generateButtonEl
- Keep the new API flow (/api/decks/{id}/prompts/next, /takes)
- Keep debug logging and storage change listener" 2>&1 || echo "Nothing new to commit"
