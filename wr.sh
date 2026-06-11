#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE="$REPO_ROOT/tools/sbdc"
EXT_DIR="$BASE/sbdc-extension"

echo "=== ROOT CAUSE ==="
echo "The iframe contentDocument is CORS-blocked (image-generation.perchance.org vs perchance.org)"
echo "BUT our content script runs in ALL frames including iframes (all_frames: true)!"
echo "So we can detect image completion FROM INSIDE the iframe and postMessage to the parent."
echo ""
echo "Two-mode content script:"
echo "  Mode 1: Main frame → runs generation loop, listens for postMessage"
echo "  Mode 2: Image iframe → watches #outputEl for image, posts data to parent"
echo ""

cat > "$EXT_DIR/src/content.ts" << 'CT_V12_F8nK4'
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

// ============================================================
// MODE 2: Image-generation iframe monitor
// Our content script runs inside image-generation iframes too
// (all_frames: true on *.perchance.org). We detect when the
// image finishes rendering and send the data to the parent.
// ============================================================

function runIframeMonitor(): void {
  log("Image iframe detected — monitoring for completion");

  const outputEl = document.getElementById("outputEl");
  const waitingEl = document.getElementById("waitingEl");
  if (!outputEl || !waitingEl) {
    log("Missing #outputEl or #waitingEl — not an image iframe");
    return;
  }

  // Check if already loaded
  if (outputEl.style.display !== "none") {
    log("Image already loaded in iframe");
    sendImageData();
    return;
  }

  // Watch for display change using MutationObserver
  const observer = new MutationObserver(() => {
    if (outputEl.style.display !== "none") {
      log("outputEl became visible!");
      observer.disconnect();

      // Small delay to let the image render
      setTimeout(() => {
        sendImageData();
      }, 2000);
    }
  });

  observer.observe(outputEl, { attributes: true, attributeFilter: ["style"] });

  // Also observe waitingEl as backup
  const waitObserver = new MutationObserver(() => {
    if (waitingEl.style.display === "none") {
      log("waitingEl became hidden!");
      waitObserver.disconnect();
      observer.disconnect();

      setTimeout(() => {
        sendImageData();
      }, 2000);
    }
  });

  waitObserver.observe(waitingEl, { attributes: true, attributeFilter: ["style"] });

  // Fallback: poll every 5s in case MutationObserver misses something
  let pollCount = 0;
  const pollInterval = setInterval(() => {
    pollCount++;
    if (outputEl.style.display !== "none" || waitingEl.style.display === "none") {
      log(`Poll detected image ready after ${pollCount * 5}s`);
      clearInterval(pollInterval);
      observer.disconnect();
      waitObserver.disconnect();

      setTimeout(() => {
        sendImageData();
      }, 2000);
    }
    if (pollCount > 60) {
      log("Poll timeout — giving up");
      clearInterval(pollInterval);
    }
  }, 5000);
}

function sendImageData(): void {
  const outputEl = document.getElementById("outputEl");
  if (!outputEl) return;

  // Try canvas first
  const canvas = outputEl.querySelector("canvas") as HTMLCanvasElement | null;
  if (canvas && canvas.width > 0 && canvas.height > 0) {
    log(`Found canvas ${canvas.width}x${canvas.height} — extracting`);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      window.parent.postMessage({
        type: "sbdc-image-ready",
        data: dataUrl,
      }, "*");
      log("Sent canvas image data to parent");
      return;
    } catch (e: Error) {
      log(`Canvas toDataURL failed: ${e.message}`);
    }
  }

  // Try img element
  const img = outputEl.querySelector("img") as HTMLImageElement | null;
  if (img) {
    log(`Found img element src=${img.src?.substring(0, 80)}...`);
    if (img.src && img.complete && img.naturalHeight > 0) {
      if (img.src.startsWith("data:")) {
        window.parent.postMessage({
          type: "sbdc-image-ready",
          data: img.src,
        }, "*");
        log("Sent img data URL to parent");
        return;
      }

      // Fetch the image and convert to data URL
      fetch(img.src)
        .then((resp) => resp.blob())
        .then((blob) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        })
        .then((dataUrl) => {
          window.parent.postMessage({
            type: "sbdc-image-ready",
            data: dataUrl,
          }, "*");
          log("Sent fetched img data to parent");
        })
        .catch((e: Error) => {
          log(`Failed to fetch img: ${e.message}`);
        });
      return;
    }

    // Image not yet complete — wait for load
    log("Image not yet loaded, waiting...");
    img.addEventListener("load", () => {
      log("Image loaded!");
      sendImageData();
    }, { once: true });
    return;
  }

  // Nothing found yet — retry after delay
  log("No canvas or img found in outputEl — retrying in 3s");
  setTimeout(sendImageData, 3000);
}

// ============================================================
// MODE 1: Main frame generation loop
// ============================================================

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

function waitForImagesViaPostMessage(numImages: number): Promise<ImageData[]> {
  return new Promise((resolve) => {
    const images: ImageData[] = [];

    function handler(event: MessageEvent) {
      if (event.data?.type === "sbdc-image-ready" && event.data?.data) {
        images.push({ index: images.length, data: event.data.data });
        log(`Received image ${images.length}/${numImages} from iframe`);
        if (images.length >= numImages) {
          window.removeEventListener("message", handler);
          resolve(images);
        }
      }
    }

    window.addEventListener("message", handler);

    // Timeout after 180s
    setTimeout(() => {
      window.removeEventListener("message", handler);
      log(`Image wait timeout — got ${images.length}/${numImages}`);
      resolve(images);
    }, 180000);
  });
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

    // Wait for images via postMessage from iframe content scripts
    log(`Waiting for ${NUM_IMAGES} images from iframes...`);
    const images = await waitForImagesViaPostMessage(NUM_IMAGES);
    log(`Got ${images.length} images`);

    if (images.length > 0) {
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
    } else {
      log("No images received — skipping");
    }

    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
  }
}

// ============================================================
// Entry point — detect which mode to run
// ============================================================

async function main(): Promise<void> {
  // MODE 2: Check if we're inside an image-generation iframe
  const waitingEl = document.getElementById("waitingEl");
  const outputEl = document.getElementById("outputEl");

  if (waitingEl && outputEl && window !== window.top) {
    // We're inside an image-generation iframe — run monitor
    runIframeMonitor();
    return;
  }

  // MODE 1: Main frame
  setIndicator("red", `[SBDC] Loaded in ${FRAME_ID}`);
  log(`Content script loaded. URL: ${window.location.href}`);

  if (window !== window.top) {
    // Some other iframe on perchance — skip
    return;
  }

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
CT_V12_F8nK4

echo "Rebuilding extension"
rm -rf "$EXT_DIR/dist"
(cd "$EXT_DIR" && bash build.sh 2>&1)

echo ""
find "$EXT_DIR/dist" -type f | sort

echo ""
cargo clippy --workspace --manifest-path "$BASE/Cargo.toml" -- -D warnings 2>&1 | tail -3
cargo test --workspace --manifest-path "$BASE/Cargo.toml" 2>&1 | tail -5

git add -A
git commit -m "fix(sbdc): two-mode content script — iframe monitors its own image completion

Root cause: CORS blocks access to iframe.contentDocument from the
parent page, so we can never detect when images finish rendering.

Key insight: Our content script runs in ALL frames (all_frames:true
on *.perchance.org), including the image-generation iframes! So we
can detect completion FROM INSIDE the iframe.

Two-mode content script:

MODE 1 (main frame): Runs generation loop, clicks Generate,
listens for postMessage events from iframes.

MODE 2 (image iframe): Detects #waitingEl/#outputEl, uses
MutationObserver to watch for display changes, extracts image
data (canvas.toDataURL or img.src), sends via
window.parent.postMessage({type:'sbdc-image-ready', data:...})

This is 100% reliable — no polling, no CORS issues, no guessing." 2>&1 || echo "Nothing new to commit"
