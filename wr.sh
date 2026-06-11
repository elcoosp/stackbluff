#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE="$REPO_ROOT/tools/sbdc"
EXT_DIR="$BASE/sbdc-extension"

echo "=== Step 1: Read the GENERATED manifest.json from dist ==="
cat "$EXT_DIR/dist/manifest.json" 2>&1

echo ""
echo "=== Step 2: The @crxjs plugin generates hashed assets but the manifest ==="
echo "=== must point to the correct paths. Let's verify each reference. ==="

echo ""
echo "Checking if manifest references match actual files..."
MANIFEST="$EXT_DIR/dist/manifest.json"

SW_PATH=$(python3 -c "
import json
with open('$MANIFEST') as f:
    m = json.load(f)
print(m.get('background', {}).get('service_worker', 'MISSING'))
" 2>&1)
echo "  background.service_worker = $SW_PATH"

CS_PATHS=$(python3 -c "
import json
with open('$MANIFEST') as f:
    m = json.load(f)
for cs in m.get('content_scripts', []):
    for js in cs.get('js', []):
        print(js)
" 2>&1)
echo "  content_scripts.js = $CS_PATHS"

POPUP_PATH=$(python3 -c "
import json
with open('$MANIFEST') as f:
    m = json.load(f)
print(m.get('action', {}).get('default_popup', 'MISSING'))
" 2>&1)
echo "  action.default_popup = $POPUP_PATH"

echo ""
echo "Verifying files exist..."
for f in "$SW_PATH" $CS_PATHS "$POPUP_PATH"; do
  FULL="$EXT_DIR/dist/$f"
  if [ -f "$FULL" ]; then
    echo "  ✅ $f exists ($(wc -c < "$FULL") bytes)"
  else
    echo "  ❌ $f MISSING (looked for $FULL)"
  fi
done

echo ""
echo "=== Step 3: Fix popup.html — must use type=module for script ==="
cat "$EXT_DIR/src/popup.html"

echo ""
echo "Writing corrected popup.html with type=module"
cat > "$EXT_DIR/src/popup.html" << 'POPUP_V4_R8nK2'
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>SBDC</title>
  <style>
    body { width: 340px; padding: 12px; font-family: system-ui, sans-serif; font-size: 13px; }
    label { display: block; margin-top: 8px; font-weight: 600; }
    input { width: 100%; box-sizing: border-box; padding: 4px 6px; margin-top: 2px; }
    button { margin-top: 10px; width: 100%; padding: 8px; cursor: pointer; font-weight: 600; }
    #status { margin-top: 10px; font-size: 12px; white-space: pre-wrap; font-family: monospace; }
    .btn-row { display: flex; gap: 6px; }
    .btn-row button { flex: 1; }
  </style>
</head>
<body>
  <h3 style="margin:0 0 8px">SBDC Deck Creator</h3>
  <label>Server URL</label>
  <input id="serverUrl" placeholder="http://localhost:8899" value="http://localhost:8899">
  <label>Deck ID</label>
  <input id="deckId" placeholder="my-deck">
  <label>Takes per prompt</label>
  <input id="takes" placeholder="4" value="4" type="number">
  <div class="btn-row">
    <button id="startBtn">Start</button>
    <button id="statusBtn">Status</button>
  </div>
  <div id="status"></div>
  <script type="module" src="./popup.ts"></script>
</body>
</html>
POPUP_V4_R8nK2

echo ""
echo "=== Step 4: Fix TypeScript files for biome/strict compliance ==="

echo "Writing background.ts"
cat > "$EXT_DIR/src/background.ts" << 'BG_V4_M2pL7'
const defaultServerUrl = "http://localhost:8899";
let serverUrl = defaultServerUrl;

interface FetchMessage {
  type: "FETCH";
  url: string;
  method?: string;
  body?: string;
}

interface SetServerUrlMessage {
  type: "SET_SERVER_URL";
  url: string;
}

interface GetServerUrlMessage {
  type: "GET_SERVER_URL";
}

interface StorageResult {
  serverUrl?: string;
  deckId?: string;
  takes?: string;
}

type ExtensionMessage = FetchMessage | SetServerUrlMessage | GetServerUrlMessage;

chrome.storage.local.get(["serverUrl"], (res: StorageResult) => {
  if (res.serverUrl) {
    serverUrl = res.serverUrl;
  }
  console.log("[BG] serverUrl:", serverUrl);
});

chrome.runtime.onMessage.addListener(
  (msg: ExtensionMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    if (msg.type === "FETCH") {
      const opts: RequestInit = { method: msg.method || "GET" };
      if (msg.body) {
        opts.body = msg.body;
        opts.headers = { "Content-Type": "application/json" };
      }
      fetch(msg.url, opts)
        .then((r) => r.text())
        .then((text) => {
          try {
            sendResponse({ ok: true, data: JSON.parse(text) });
          } catch {
            sendResponse({ ok: true, data: text });
          }
        })
        .catch((e: Error) => {
          console.error("[BG] fetch error:", e);
          sendResponse({ ok: false, error: String(e) });
        });
      return true;
    }

    if (msg.type === "SET_SERVER_URL") {
      serverUrl = msg.url;
      chrome.storage.local.set({ serverUrl });
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === "GET_SERVER_URL") {
      sendResponse({ ok: true, url: serverUrl });
      return false;
    }

    return false;
  },
);
BG_V4_M2pL7

echo "Writing content.ts"
cat > "$EXT_DIR/src/content.ts" << 'CT_V4_Q5wR3'
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

interface SubmitPayload {
  images: ImageData[];
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
}

const FRAME_ID = window.location.hostname.substring(0, 40);

function log(m: string): void {
  const line = `[SBDC][${FRAME_ID}] ${m}`;
  console.log(`%c${line}`, "color:#0ff;font-weight:bold;font-size:14px;");
  try {
    const ind = document.getElementById("sbdc-indicator");
    if (ind) {
      ind.textContent = line;
    }
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

async function waitForUI(): Promise<boolean> {
  for (let i = 0; i < 120; i++) {
    if (
      document.querySelector('textarea[data-name="description"]') &&
      document.querySelector("#generateButtonEl")
    ) {
      log(`UI found after ${i}s`);
      return true;
    }
    if (i % 5 === 0) {
      log(`Waiting for UI... (${i}s)`);
      setIndicator("red", `[SBDC] Waiting for UI... (${i}s)`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  log("No UI found. Exiting.");
  setIndicator("orange", "[SBDC] No generator UI");
  return false;
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
    log(`FETCH response: ${JSON.stringify(resp).substring(0, 200)}`);
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
  if (!el) {
    log(`Not found: ${selector}`);
    return false;
  }
  el.focus();
  el.setSelectionRange(0, el.value.length);
  const ok = document.execCommand("insertText", false, value);
  if (!ok) {
    log("execCommand failed, using setter");
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

async function main(): Promise<void> {
  if (!(await waitForUI())) return;

  setIndicator("green", "[SBDC] UI ready! Checking server...");

  const deckId = await getDeckId();
  if (!deckId) {
    log("No deck ID set. Use popup to configure.");
    setIndicator("orange", "[SBDC] No deck ID — use popup");
    return;
  }
  log(`Using deck: ${deckId}`);

  let ready = false;
  while (!ready) {
    try {
      const status = (await serverFetch(`/api/decks/${deckId}/status`)) as StatusData;
      log(`Status: ${JSON.stringify(status)}`);
      if (status && status.ready_to_generate > 0) {
        ready = true;
        log(`${status.ready_to_generate} prompts ready!`);
        setIndicator("green", `[SBDC] ${status.ready_to_generate} prompts! Starting...`);
      } else {
        log("Server OK but no prompts ready. Use popup to start.");
        setIndicator("orange", "[SBDC] No prompts — click Start");
      }
    } catch (e: Error) {
      log(`Server not reachable: ${e.message}`);
      setIndicator("darkred", "[SBDC] No server");
    }
    if (!ready) await new Promise((r) => setTimeout(r, 3000));
  }

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
      setIndicator("orange", "[SBDC] No more prompts — start from popup");
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    if (!item || !item.prompt_id) {
      log("All prompts complete!");
      setIndicator("blue", "[SBDC] ALL DONE!");
      break;
    }

    log(`Processing prompt_id=${item.prompt_id} card=${item.target_card} layer=${item.target_layer}`);
    setIndicator("green", `[SBDC] Prompt ${item.target_card}/${item.target_layer}`);

    const statusResp = (await serverFetch(`/api/decks/${deckId}/status`)) as StatusData;
    const numImages =
      statusResp && statusResp.takes_per_prompt > 0 ? statusResp.takes_per_prompt : 4;
    const ns = document.querySelector('select[data-name="numImages"]') as HTMLSelectElement | null;
    if (ns) {
      ns.value = String(numImages);
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
    log(`Generating ${numImages} (before: ${before})...`);
    setIndicator("darkgreen", `[SBDC] Generating ${item.target_card}...`);
    document.querySelector("#generateButtonEl")!.click();

    await new Promise<void>((resolve) => {
      const iv = setInterval(() => {
        const imgs = document.querySelectorAll("#outputAreaEl img");
        if (imgs.length >= before + numImages) {
          let allOk = true;
          for (let i = before; i < before + numImages; i++) {
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
    for (let i = before; i < before + numImages; i++) {
      const imgEl = imgs[i] as HTMLImageElement;
      const src = imgEl.src;
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
      const resultUrl = `/api/decks/${deckId}/prompts/${item.prompt_id}/takes`;
      await serverFetch(resultUrl, "POST", JSON.stringify({ images } as SubmitPayload));
      log(`Takes submitted for prompt ${item.prompt_id}`);
    } catch (e: Error) {
      log(`Submit failed: ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
  }
}

main().catch((e: Error) => {
  log(`Fatal: ${e.message}`);
});
CT_V4_Q5wR3

echo "Writing popup.ts"
cat > "$EXT_DIR/src/popup.ts" << 'POP_V4_N7tJ5'
const serverUrlEl = document.getElementById("serverUrl") as HTMLInputElement;
const deckIdEl = document.getElementById("deckId") as HTMLInputElement;
const takesEl = document.getElementById("takes") as HTMLInputElement;
const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const statusBtn = document.getElementById("statusBtn") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;

interface StorageResult {
  serverUrl?: string;
  deckId?: string;
  takes?: string;
}

interface StartResponse {
  deck_id: string;
  takes_per_prompt: number;
  prompts_ready: number;
}

interface StatusResponse {
  deck_id: string;
  status: string;
  total_prompts: number;
  ready_to_generate: number;
  generating: number;
  takes_ready: number;
  cleaned: number;
  takes_per_prompt: number;
}

chrome.storage.local.get(["serverUrl", "deckId", "takes"], (res: StorageResult) => {
  if (res.serverUrl) serverUrlEl.value = res.serverUrl;
  if (res.deckId) deckIdEl.value = res.deckId;
  if (res.takes) takesEl.value = res.takes;
});

startBtn.addEventListener("click", async () => {
  const url = serverUrlEl.value.replace(/\/$/, "");
  const deck = deckIdEl.value.trim();
  const numTakes = parseInt(takesEl.value, 10) || 4;

  if (!deck) {
    statusEl.textContent = "Please enter a Deck ID";
    return;
  }

  chrome.storage.local.set({ serverUrl: url, deckId: deck, takes: takesEl.value });
  chrome.runtime.sendMessage({ type: "SET_SERVER_URL", url });

  statusEl.textContent = "Starting generation...";

  try {
    const resp = await fetch(
      `${url}/api/decks/${encodeURIComponent(deck)}/start`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ takes_per_prompt: numTakes }),
      },
    );

    if (resp.ok) {
      const data: StartResponse = await resp.json();
      statusEl.textContent =
        `Started! ${data.prompts_ready || 0} prompts ready.\n` +
        `Takes per prompt: ${data.takes_per_prompt || numTakes}\n` +
        "Open perchance.org/fluxgen";
    } else {
      const text = await resp.text();
      statusEl.textContent = `HTTP ${resp.status}\n${text}`;
    }
  } catch (e: Error) {
    statusEl.textContent =
      `FETCH FAILED:\n${e.message}\n\nIs server running?\n` +
      "cargo run --bin sbdc -- serve --port 8899";
  }
});

statusBtn.addEventListener("click", async () => {
  const url = serverUrlEl.value.replace(/\/$/, "");
  const deck = deckIdEl.value.trim();

  if (!deck) {
    statusEl.textContent = "Please enter a Deck ID";
    return;
  }

  statusEl.textContent = "Checking...";

  try {
    const resp = await fetch(`${url}/api/decks/${encodeURIComponent(deck)}/status`);
    if (resp.ok) {
      const data: StatusResponse = await resp.json();
      statusEl.textContent =
        `Deck: ${data.deck_id}\n` +
        `Status: ${data.status}\n` +
        `Total: ${data.total_prompts}\n` +
        `Ready: ${data.ready_to_generate}\n` +
        `Generating: ${data.generating}\n` +
        `Takes ready: ${data.takes_ready}\n` +
        `Cleaned: ${data.cleaned}`;
    } else {
      statusEl.textContent = `HTTP ${resp.status}`;
    }
  } catch (e: Error) {
    statusEl.textContent = `FETCH FAILED:\n${e.message}`;
  }
});
POP_V4_N7tJ5

echo ""
echo "=== Step 5: Rebuild extension ==="
rm -rf "$EXT_DIR/dist"
(cd "$EXT_DIR" && pnpm run build 2>&1)

echo ""
echo "=== Step 6: Verify build ==="
echo "Dist tree:"
find "$EXT_DIR/dist" -type f | sort

echo ""
echo "Generated manifest.json:"
cat "$EXT_DIR/dist/manifest.json"

echo ""
echo "Verifying manifest paths match actual files..."
python3 << 'PYEOF_VERIFY'
import json
import os

ext_dir = os.environ.get("EXT_DIR", ".")
manifest_path = f"{ext_dir}/dist/manifest.json"
dist_dir = f"{ext_dir}/dist"

with open(manifest_path) as f:
    m = json.load(f)

errors = []

sw = m.get("background", {}).get("service_worker", "")
if os.path.isfile(f"{dist_dir}/{sw}"):
    print(f"  ✅ background.service_worker → {sw}")
else:
    errors.append(f"background.service_worker → {sw} MISSING")
    print(f"  ❌ background.service_worker → {sw} MISSING")

for i, cs in enumerate(m.get("content_scripts", [])):
    for js in cs.get("js", []):
        if os.path.isfile(f"{dist_dir}/{js}"):
            print(f"  ✅ content_scripts[{i}].js → {js}")
        else:
            errors.append(f"content_scripts[{i}].js → {js} MISSING")
            print(f"  ❌ content_scripts[{i}].js → {js} MISSING")

popup = m.get("action", {}).get("default_popup", "")
if os.path.isfile(f"{dist_dir}/{popup}"):
    print(f"  ✅ action.default_popup → {popup}")
else:
    errors.append(f"action.default_popup → {popup} MISSING")
    print(f"  ❌ action.default_popup → {popup} MISSING")

if errors:
    print(f"\n⚠️  {len(errors)} path mismatch(es) found!")
    print("The generated manifest references files that don't exist.")
    print("This means @crxjs is NOT rewriting the manifest paths correctly.")
else:
    print("\n✅ All manifest paths resolve to actual files — extension should load!")
PYEOF_VERIFY

echo ""
echo "Checking Rust compilation"
if ! cargo check --workspace --manifest-path "$BASE/Cargo.toml" 2>&1; then
  echo "Compilation failed – will skip commit"
  COMPILE_OK=false
fi

if [ "$INCOMPLETE" = true ] || [ "$COMPILE_OK" = false ]; then
  echo "Skipping tests and commit due to incomplete files or compilation errors"
  exit 1
fi

echo "Running tests"
cargo test --workspace --manifest-path "$BASE/Cargo.toml" 2>&1
if [ $? -eq 0 ]; then
  echo "All tests passed. Committing."
  git add -A
  git commit -m "fix(sbdc): rewrite TS with proper types, fix popup.html module script

- Add type annotations to all TS files for strict compliance
- Fix popup.html: add type=module to script tag
- Rewrite background.ts with proper message type discrimination
- Rewrite content.ts with explicit interfaces and error handling
- Rewrite popup.ts with typed API responses
- Verify generated manifest paths match actual dist files"
else
  echo "Tests failed. Fix errors then run the next script."
  exit 1
fi
