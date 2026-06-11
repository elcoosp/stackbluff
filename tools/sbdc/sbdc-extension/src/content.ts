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
// ============================================================

function isImageIframe(): boolean {
  return !!(document.getElementById("waitingEl") && document.getElementById("outputEl"));
}

function runIframeMonitor(): void {
  log("Image iframe detected — monitoring for completion");

  const outputEl = document.getElementById("outputEl")!;
  const waitingEl = document.getElementById("waitingEl")!;

  // Check if already loaded
  if (outputEl.style.display !== "none") {
    log("Image already loaded in iframe");
    sendImageData();
    return;
  }

  // Watch for outputEl to become visible
  const observer = new MutationObserver(() => {
    if (outputEl.style.display !== "none") {
      log("outputEl became visible!");
      observer.disconnect();
      setTimeout(() => sendImageData(), 2000);
    }
  });
  observer.observe(outputEl, { attributes: true, attributeFilter: ["style"] });

  // Also watch waitingEl becoming hidden
  const waitObserver = new MutationObserver(() => {
    if (waitingEl.style.display === "none") {
      log("waitingEl became hidden!");
      waitObserver.disconnect();
      observer.disconnect();
      setTimeout(() => sendImageData(), 2000);
    }
  });
  waitObserver.observe(waitingEl, { attributes: true, attributeFilter: ["style"] });

  // Fallback poll
  let pollCount = 0;
  const pollInterval = setInterval(() => {
    pollCount++;
    if (outputEl.style.display !== "none" || waitingEl.style.display === "none") {
      log(`Poll detected image ready after ${pollCount * 5}s`);
      clearInterval(pollInterval);
      observer.disconnect();
      waitObserver.disconnect();
      setTimeout(() => sendImageData(), 2000);
    }
    if (pollCount > 60) {
      clearInterval(pollInterval);
    }
  }, 5000);
}

function sendImageData(): void {
  const outputEl = document.getElementById("outputEl");
  if (!outputEl) return;

  const canvas = outputEl.querySelector("canvas") as HTMLCanvasElement | null;
  if (canvas && canvas.width > 0 && canvas.height > 0) {
    try {
      const dataUrl = canvas.toDataURL("image/png");
      window.parent.postMessage({ type: "sbdc-image-ready", data: dataUrl }, "*");
      log("Sent canvas image to parent");
      return;
    } catch { /* fall through */ }
  }

  const img = outputEl.querySelector("img") as HTMLImageElement | null;
  if (img && img.src) {
    if (img.complete && img.naturalHeight > 0) {
      if (img.src.startsWith("data:")) {
        window.parent.postMessage({ type: "sbdc-image-ready", data: img.src }, "*");
        log("Sent img data URL to parent");
        return;
      }
      fetch(img.src)
        .then((r) => r.blob())
        .then((blob) => new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(blob);
        }))
        .then((dataUrl) => {
          window.parent.postMessage({ type: "sbdc-image-ready", data: dataUrl }, "*");
          log("Sent fetched img to parent");
        })
        .catch((e: Error) => log(`Fetch failed: ${e.message}`));
      return;
    }
    img.addEventListener("load", () => sendImageData(), { once: true });
    return;
  }

  setTimeout(sendImageData, 3000);
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
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function waitForImagesViaPostMessage(numImages: number): Promise<ImageData[]> {
  return new Promise((resolve) => {
    const images: ImageData[] = [];
    const timeout = 180000;

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
// Entry point — detect which mode based on content
// ============================================================

async function main(): Promise<void> {
  log(`Content script loaded. URL: ${window.location.href}`);

  // MODE 2: Image-generation iframe (has #waitingEl + #outputEl)
  if (isImageIframe()) {
    runIframeMonitor();
    return;
  }

  // MODE 1: Generator UI (has textarea + generate button)
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
          runGeneration().catch((e: Error) => log(`Fatal: ${e.message}`));
        }
      });
    }
    return;
  }

  // Not a recognized frame — skip
  log(`Not a generator or image frame — skipping`);
}

main().catch((e: Error) => {
  log(`Fatal: ${e.message}`);
});
