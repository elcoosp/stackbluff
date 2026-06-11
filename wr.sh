#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE="$REPO_ROOT/tools/sbdc"
EXT_DIR="$BASE/sbdc-extension"

echo "=== ROOT CAUSE ==="
echo "Perchance CLEARS old images when you click Generate."
echo "So beforeCount=4 (from previous prompt), then after clicking Generate"
echo "the old 4 disappear, 4 new ones appear, total=4 not 8."
echo "Script waits for 4+4=8 forever."
echo ""
echo "Fix: After clicking Generate, wait for clear, then wait for NUM_IMAGES new ones."
echo ""

cat > "$EXT_DIR/src/content.ts" << 'CT_V10_R5mK2'
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
  } catch { /* ignore */ }
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
  } catch { /* ignore */ }
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

function setNativeValue(element: HTMLTextAreaElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
}

function fillTextarea(selector: string, value: string): boolean {
  const el = document.querySelector(selector) as HTMLTextAreaElement | null;
  if (!el) return false;
  el.focus();
  el.blur();
  el.focus();
  setNativeValue(el, "");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  setNativeValue(el, value);
  el.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    cancelable: false,
    data: value,
    inputType: "insertText",
  }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function countOutputImages(): number {
  const iframes = document.querySelectorAll("iframe.text-to-image-plugin-image-iframe");
  if (iframes.length > 0) return iframes.length;
  const imgs = document.querySelectorAll("#outputAreaEl img");
  if (imgs.length > 0) return imgs.length;
  const containers = document.querySelectorAll(".t2i-image-ctn");
  return containers.length;
}

async function waitForUI(): Promise<boolean> {
  for (let i = 0; i < 120; i++) {
    const desc = document.querySelector('textarea[data-name="description"]');
    const genBtn = document.querySelector("#generateButtonEl");
    if (i === 0) {
      log(`Scanning ${FRAME_ID}...`);
      log(`  textarea: ${desc ? "FOUND" : "not found"}`);
      log(`  generateBtn: ${genBtn ? "FOUND" : "not found"}`);
    }
    if (desc && genBtn) {
      log(`UI found in ${FRAME_ID}`);
      return true;
    }
    if (i % 10 === 0 && i > 0) log(`Waiting for UI... (${i}s)`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function waitForNewImages(expectedCount: number): Promise<boolean> {
  // Perchance clears old images when Generate is clicked.
  // Strategy: wait for output to stabilize at exactly expectedCount images.
  const timeout = 180;
  let stableCount = 0;
  let lastCount = -1;

  for (let i = 0; i < timeout; i++) {
    const currentCount = countOutputImages();

    if (currentCount === expectedCount) {
      if (currentCount !== lastCount) {
        log(`Count reached ${currentCount}, confirming stable...`);
        lastCount = currentCount;
      }
      stableCount++;
      if (stableCount >= 3) {
        log(`Confirmed ${expectedCount} images stable after ${i}s`);
        // Extra wait for images to fully render inside iframes
        await new Promise((r) => setTimeout(r, 3000));
        return true;
      }
    } else {
      stableCount = 0;
      if (i % 10 === 0) {
        log(`Waiting for images... count=${currentCount} (expect ${expectedCount}) (${i}s)`);
      }
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  log(`Timeout after ${timeout}s. Final count: ${countOutputImages()}`);
  return false;
}

async function extractImageFromIframe(iframe: HTMLIFrameElement): Promise<string | null> {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return null;
    const canvas = doc.querySelector("canvas");
    if (canvas) return canvas.toDataURL("image/png");
    const img = doc.querySelector("img");
    if (img && img.src) {
      if (img.src.startsWith("data:")) return img.src;
      try {
        const resp = await fetch(img.src);
        const blob = await resp.blob();
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch { /* fall through */ }
    }
  } catch { /* CORS blocked */ }

  // Try fetching the iframe URL directly
  try {
    const iframeSrc = iframe.src || iframe.getAttribute("data-src") || "";
    if (iframeSrc.includes("image-generation.perchance.org")) {
      const resp = await fetch(iframeSrc);
      const html = await resp.text();
      const match = html.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (match) return match[0];
    }
  } catch { /* fall through */ }

  return null;
}

async function extractAllImages(): Promise<ImageData[]> {
  const images: ImageData[] = [];

  // Try iframes first
  const iframes = document.querySelectorAll("iframe.text-to-image-plugin-image-iframe");
  if (iframes.length > 0) {
    for (let i = 0; i < iframes.length; i++) {
      const data = await extractImageFromIframe(iframes[i] as HTMLIFrameElement);
      if (data) {
        images.push({ index: i, data });
        log(`Extracted image ${images.length} from iframe[${i}]`);
      } else {
        log(`Could not extract from iframe[${i}]`);
      }
    }
  }

  // Fallback: img tags
  if (images.length === 0) {
    const imgs = document.querySelectorAll("#outputAreaEl img");
    for (let i = 0; i < imgs.length; i++) {
      const src = (imgs[i] as HTMLImageElement).src;
      if (src.startsWith("data:")) {
        images.push({ index: i, data: src });
      } else {
        try {
          const resp = await fetch(src);
          const blob = await resp.blob();
          const data = await new Promise<string>((res) => {
            const rd = new FileReader();
            rd.onload = () => res(rd.result as string);
            rd.readAsDataURL(blob);
          });
          images.push({ index: i, data });
        } catch { /* skip */ }
      }
    }
  }

  return images;
}

async function runGeneration(): Promise<void> {
  const deckId = await getDeckId();
  if (!deckId) {
    log("No deck ID — open popup");
    setIndicator("orange", "[SBDC] Configure in popup");
    return;
  }

  log(`Deck: ${deckId}`);

  let ready = false;
  while (!ready) {
    try {
      const status = (await serverFetch(`/api/decks/${deckId}/status`)) as StatusData;
      if (status.ready_to_generate > 0 || status.status === "generating") {
        ready = true;
        setIndicator("green", `[SBDC] Ready!`);
      } else {
        setIndicator("orange", "[SBDC] Click Start in popup!");
      }
    } catch {
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
    } catch {
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
      log("ALL DONE!");
      setIndicator("blue", "[SBDC] ALL DONE!");
      break;
    }

    log(`=== ${item.target_card}/${item.target_layer} (id=${item.prompt_id}) ===`);
    setIndicator("green", `[SBDC] ${item.target_card}/${item.target_layer}`);

    const ns = document.querySelector('select[data-name="numImages"]') as HTMLSelectElement | null;
    if (ns) {
      ns.value = String(NUM_IMAGES);
      ns.dispatchEvent(new Event("change", { bubbles: true }));
    }

    fillTextarea('textarea[data-name="description"]', String(item.positive));

    if (item.negative) {
      const neg = document.querySelector('textarea[data-name="negative"]') as HTMLTextAreaElement | null;
      if (neg) {
        const ctn = neg.closest(".input-ctn") as HTMLElement | null;
        if (ctn && ctn.dataset.foldToggleState === "hidden") {
          ctn.dataset.foldToggleState = "shown";
          await new Promise((r) => setTimeout(r, 500));
        }
        fillTextarea('textarea[data-name="negative"]', String(item.negative));
      }
    }

    await new Promise((r) => setTimeout(r, 500));

    log(`Clicking Generate...`);
    setIndicator("darkgreen", `[SBDC] Generating ${item.target_card}...`);
    document.querySelector("#generateButtonEl")!.click();

    // Wait for exactly NUM_IMAGES new images to appear and stabilize
    const loaded = await waitForNewImages(NUM_IMAGES);
    if (!loaded) {
      log("Image load timeout, moving to next prompt");
      continue;
    }

    log("Extracting images...");
    const images = await extractAllImages();
    log(`Extracted ${images.length} images`);

    try {
      await serverFetch(
        `/api/decks/${deckId}/prompts/${item.prompt_id}/takes`,
        "POST",
        JSON.stringify({ images }),
      );
      log(`Submitted ${images.length} takes for prompt ${item.prompt_id}`);
    } catch (e: Error) {
      log(`Submit failed: ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
  }
}

async function main(): Promise<void> {
  setIndicator("red", `[SBDC] Loaded in ${FRAME_ID}`);
  log(`Content script loaded. URL: ${window.location.href}`);

  if (!(await waitForUI())) return;

  setIndicator("green", "[SBDC] UI ready!");
  log("UI ready!");

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
CT_V10_R5mK2

echo "Rebuilding extension"
rm -rf "$EXT_DIR/dist"
(cd "$EXT_DIR" && bash build.sh 2>&1)

echo ""
echo "Dist:"
find "$EXT_DIR/dist" -type f | sort

echo ""
cargo clippy --workspace --manifest-path "$BASE/Cargo.toml" -- -D warnings 2>&1 | tail -3
cargo test --workspace --manifest-path "$BASE/Cargo.toml" 2>&1 | tail -5

git add -A
git commit -m "fix(sbdc): fix image count after Generate — perchance clears old images

Root cause: When Generate is clicked, perchance.org clears the old
images from the output area before adding new ones. The script was
counting existing images (beforeCount=4) and waiting for 4+4=8, but
the old 4 get removed so the total only reaches 4.

Fix: Instead of counting before/after delta, just wait for the
output to stabilize at exactly NUM_IMAGES (=4) images:
- Wait for countOutputImages() === NUM_IMAGES
- Require 3 consecutive stable reads to confirm
- Add 3s extra wait after stabilization for iframe rendering" 2>&1 || echo "Nothing new to commit"
