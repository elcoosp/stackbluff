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
// MODE 2: Image-generation iframe monitor (FIXED DUPLICATES)
// ============================================================

function isImageIframe(): boolean {
  return !!(document.getElementById("waitingEl") && document.getElementById("outputEl"));
}

function runIframeMonitor(): void {
  log("Image iframe detected — monitoring for completion");

  const outputEl = document.getElementById("outputEl");
  const waitingEl = document.getElementById("waitingEl");

  // Safety: if elements don't exist, abort
  if (!outputEl || !waitingEl) {
    log("Required elements missing — aborting iframe monitor");
    return;
  }

  let alreadySent = false;   // prevents duplicate sends from this iframe

  const sendOnce = () => {
    if (alreadySent) {
      log("Already sent this image — ignoring duplicate trigger");
      return;
    }
    sendImageData(() => alreadySent, (v) => { alreadySent = v; });
  };

  // If image already visible, send it
  if (outputEl.style.display !== "none") {
    log("Image already loaded");
    sendOnce();
    return;
  }

  // Watch for outputEl to become visible
  const observer = new MutationObserver(() => {
    if (outputEl && outputEl.style.display !== "none") {
      log("outputEl became visible!");
      observer.disconnect();
      setTimeout(sendOnce, 2000);
    }
  });
  observer.observe(outputEl, { attributes: true, attributeFilter: ["style"] });

  // Watch for waitingEl to become hidden
  const waitObserver = new MutationObserver(() => {
    if (waitingEl && waitingEl.style.display === "none") {
      log("waitingEl became hidden!");
      waitObserver.disconnect();
      observer.disconnect();
      setTimeout(sendOnce, 2000);
    }
  });
  waitObserver.observe(waitingEl, { attributes: true, attributeFilter: ["style"] });

  // Fallback poll (safety net)
  let pollCount = 0;
  const pollInterval = setInterval(() => {
    pollCount++;
    if ((outputEl && outputEl.style.display !== "none") || (waitingEl && waitingEl.style.display === "none")) {
      log(`Poll detected ready after ${pollCount * 5}s`);
      clearInterval(pollInterval);
      if (observer) observer.disconnect();
      if (waitObserver) waitObserver.disconnect();
      setTimeout(sendOnce, 2000);
    }
    if (pollCount > 60) clearInterval(pollInterval);
  }, 5000);
}

/**
 * Send the generated image to the parent window exactly once.
 * Does NOT use requestId (backward compatible).
 */
function sendImageData(
  getSent: () => boolean,
  setSent: (val: boolean) => void,
): void {
  if (getSent()) {
    log("sendImageData called but already sent — aborting");
    return;
  }

  const outputEl = document.getElementById("outputEl");
  if (!outputEl) return;

  // Try canvas
  const canvas = outputEl.querySelector("canvas") as HTMLCanvasElement | null;
  if (canvas && canvas.width > 0 && canvas.height > 0) {
    try {
      const dataUrl = canvas.toDataURL("image/png");
      setSent(true);
      window.parent.postMessage({ type: "sbdc-image-ready", data: dataUrl }, "*");
      log("Sent canvas image to parent");
      return;
    } catch { /* fall through */ }
  }

  // Try img element
  const img = outputEl.querySelector("img") as HTMLImageElement | null;
  if (img && img.src && img.complete && img.naturalHeight > 0) {
    const send = (dataUrl: string) => {
      if (getSent()) return;
      setSent(true);
      window.parent.postMessage({ type: "sbdc-image-ready", data: dataUrl }, "*");
      log("Sent img image to parent");
    };

    if (img.src.startsWith("data:")) {
      send(img.src);
    } else {
      fetch(img.src)
        .then(r => r.blob())
        .then(blob => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        }))
        .then(dataUrl => send(dataUrl))
        .catch(e => log(`Fetch failed: ${e.message}`));
    }
    return;
  }

  // If image not ready yet, retry after delay (only if not already sent)
  if (!getSent()) {
    log("Image not ready — retrying in 3s");
    setTimeout(() => sendImageData(getSent, setSent), 3000);
  }
}

// ============================================================
// MODE 1: Generator UI — fill prompts and generate
// ============================================================

function isGeneratorUI(): boolean {
  return !!(
    document.querySelector('textarea[data-name="description"]') ||
    document.querySelector("#generateButtonEl")
  );
}

async function waitForUI(): Promise<boolean> {
  for (let i = 0; i < 120; i++) {
    const desc = document.querySelector('textarea[data-name="description"]');
    const genBtn = document.querySelector("#generateButtonEl");
    if (i === 0) {
      log(`Scanning ${FRAME_ID}...`);
      log(`  textarea: ${desc ? "FOUND" : "not found"}`);
      log(`  generateBtn: ${genBtn ? "FOUND" : "not found"}`);
      log(`  URL: ${window.location.href}`);
    }
    if (desc && genBtn) {
      log(`Generator UI found in ${FRAME_ID}`);
      return true;
    }
    if (i % 10 === 0 && i > 0) log(`Waiting for UI... (${i}s)`);
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Wait for images from any iframe (no requestId filtering).
 * This matches the original behavior and ensures images are received.
 */
function waitForImagesViaPostMessage(numImages: number): Promise<ImageData[]> {
  return new Promise((resolve) => {
    const images: ImageData[] = [];
    const timeout = 180000; // 3 minutes

    function handler(event: MessageEvent) {
      if (event.data?.type === "sbdc-image-ready" && event.data?.data) {
        images.push({ index: images.length, data: event.data.data });
        log(`Received image ${images.length}/${numImages}`);
        if (images.length >= numImages) {
          window.removeEventListener("message", handler);
          resolve(images);
        }
      }
    }

    window.addEventListener("message", handler);
    setTimeout(() => {
      window.removeEventListener("message", handler);
      log(`Timeout — got ${images.length}/${numImages} images`);
      resolve(images);
    }, timeout);
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
  const NUM_IMAGES = 4;

  // Wait until server says we can start
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
    if (!ready) await new Promise(r => setTimeout(r, 3000));
  }

  // Main sequential loop
  while (true) {
    // 1. Fetch next prompt (server should atomically claim it)
    let item: PromptData | null = null;
    try {
      const data = await serverFetch(`/api/decks/${deckId}/prompts/next`);
      item = data as PromptData;
    } catch (e) {
      log(`Failed to fetch next prompt: ${e}`);
      setIndicator("darkred", "[SBDC] Server error");
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    if (item && item.status === "no_more_prompts") {
      setIndicator("orange", "[SBDC] No more prompts");
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }

    if (!item || !item.prompt_id) {
      log("ALL DONE!");
      setIndicator("blue", "[SBDC] ALL DONE!");
      break;
    }

    log(`=== PROCESSING ${item.target_card}/${item.target_layer} (id=${item.prompt_id}) ===`);
    setIndicator("green", `[SBDC] ${item.target_card}/${item.target_layer}`);

    // 2. Set UI for this prompt
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
          await new Promise(r => setTimeout(r, 500));
        }
        fillTextarea('textarea[data-name="negative"]', String(item.negative));
      }
    }

    await new Promise(r => setTimeout(r, 500));

    // 3. Click Generate
    log(`Clicking Generate for ${item.target_card}/${item.target_layer}...`);
    setIndicator("darkgreen", `[SBDC] Generating ${item.target_card}...`);
    const genBtn = document.querySelector("#generateButtonEl") as HTMLButtonElement | null;
    if (!genBtn) {
      log("Generate button not found — aborting this prompt");
      continue;
    }
    genBtn.click();

    // 4. Wait for images (accepts all messages)
    const images = await waitForImagesViaPostMessage(NUM_IMAGES);
    log(`Got ${images.length} images for prompt ${item.prompt_id}`);

    // 5. Submit takes
    if (images.length > 0) {
      try {
        await serverFetch(
          `/api/decks/${deckId}/prompts/${item.prompt_id}/takes`,
          "POST",
          JSON.stringify({ images }),
        );
        log(`✅ Submitted ${images.length} takes for prompt ${item.prompt_id}`);
      } catch (e: any) {
        log(`❌ Submit failed: ${e.message}`);
      }
    } else {
      log(`⚠️ No images received for prompt ${item.prompt_id} — skipping`);
    }

    // 6. Extra safety: wait a moment before fetching next prompt
    await new Promise(r => setTimeout(r, 2000));

    // Loop continues to next prompt
  }
}

// ============================================================
// Entry point
// ============================================================

async function main(): Promise<void> {
  log(`Content script loaded. URL: ${window.location.href}`);

  if (isImageIframe()) {
    runIframeMonitor();
    return;
  }

  if (isGeneratorUI()) {
    setIndicator("red", `[SBDC] Generator UI in ${FRAME_ID}`);
    if (!(await waitForUI())) return;
    setIndicator("green", "[SBDC] UI ready!");

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
          runGeneration().catch(e => log(`Fatal: ${e.message}`));
        }
      });
    }
    return;
  }

  log(`Not a generator or image frame — skipping`);
}

main().catch(e => log(`Fatal: ${e.message}`));
