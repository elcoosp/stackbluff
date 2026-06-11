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
  const imgs = document.querySelectorAll("#outputAreaEl img");
  const containers = document.querySelectorAll(".t2i-image-ctn");
  return iframes.length || imgs.length || containers.length;
}

async function waitForUI(): Promise<boolean> {
  for (let i = 0; i < 120; i++) {
    const desc = document.querySelector('textarea[data-name="description"]');
    const genBtn = document.querySelector("#generateButtonEl");

    if (i === 0) {
      log(`Scanning ${FRAME_ID}...`);
      log(`  textarea: ${desc ? "FOUND" : "not found"}`);
      log(`  generateBtn: ${genBtn ? "FOUND" : "not found"}`);
      log(`  iframes: ${document.querySelectorAll("iframe.text-to-image-plugin-image-iframe").length}`);
      log(`  .t2i-image-ctn: ${document.querySelectorAll(".t2i-image-ctn").length}`);
      log(`  #outputAreaEl img: ${document.querySelectorAll("#outputAreaEl img").length}`);
    }

    if (desc && genBtn) {
      log(`UI found in ${FRAME_ID}`);
      return true;
    }

    if (i % 10 === 0 && i > 0) {
      log(`Waiting for UI... (${i}s)`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function waitForImagesToLoad(beforeCount: number, expected: number): Promise<boolean> {
  const timeout = 180;
  for (let i = 0; i < timeout; i++) {
    const currentCount = countOutputImages();
    if (currentCount >= beforeCount + expected) {
      log(`All ${expected} iframes appeared after ${i}s`);

      await new Promise((r) => setTimeout(r, 3000));

      let allLoaded = true;
      const iframes = document.querySelectorAll("iframe.text-to-image-plugin-image-iframe");
      for (let j = beforeCount; j < beforeCount + expected; j++) {
        const iframe = iframes[j] as HTMLIFrameElement;
        if (iframe) {
          try {
            const doc = iframe.contentDocument;
            if (doc) {
              const canvas = doc.querySelector("canvas");
              const img = doc.querySelector("img");
              if (!canvas && !img) {
                allLoaded = false;
                if (i % 10 === 0) {
                  log(`Iframe ${j}: no canvas/img yet`);
                }
              }
            }
          } catch {
            // CORS - iframe loaded but we can't access content
            // That's OK, the image is still generated
          }
        }
      }

      if (allLoaded) {
        log("All images fully rendered");
        return true;
      }

      if (i > 30) {
        log("Images appeared, proceeding even if some iframes not fully accessible");
        return true;
      }
    }

    if (i % 10 === 0 && i > 0) {
      log(`Waiting for images... ${currentCount}/${beforeCount + expected} (${i}s)`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  log(`Timeout waiting for images after ${timeout}s`);
  return false;
}

async function extractImageFromIframe(iframe: HTMLIFrameElement): Promise<string | null> {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return null;

    const canvas = doc.querySelector("canvas");
    if (canvas) {
      log("Extracting from canvas inside iframe");
      return canvas.toDataURL("image/png");
    }

    const img = doc.querySelector("img");
    if (img && img.src) {
      log("Extracting from img inside iframe");
      if (img.src.startsWith("data:")) {
        return img.src;
      }
      try {
        const resp = await fetch(img.src);
        const blob = await resp.blob();
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch {
        log("Failed to fetch img src from iframe");
      }
    }
  } catch {
    // CORS blocked - try alternative method
    log("CORS blocked iframe content access, trying alternative extraction");
  }

  try {
    const iframeSrc = iframe.src || iframe.getAttribute("data-src") || "";
    if (iframeSrc.includes("image-generation.perchance.org")) {
      log("Attempting to fetch iframe page directly");
      const resp = await fetch(iframeSrc);
      const html = await resp.text();

      const dataUrlMatch = html.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (dataUrlMatch) {
        log("Found data URL in iframe HTML");
        return dataUrlMatch[0];
      }

      const srcMatch = html.match(/src=["'](data:image\/[^"']+)["']/);
      if (srcMatch) {
        log("Found src data URL in iframe HTML");
        return srcMatch[1];
      }
    }
  } catch (e: Error) {
    log(`Alternative extraction failed: ${e.message}`);
  }

  return null;
}

async function extractImagesFromOutput(beforeCount: number, count: number): Promise<ImageData[]> {
  const images: ImageData[] = [];

  const iframes = document.querySelectorAll("iframe.text-to-image-plugin-image-iframe");
  const iframeList = Array.from(iframes);

  for (let i = beforeCount; i < beforeCount + count && i < iframeList.length; i++) {
    const iframe = iframeList[i] as HTMLIFrameElement;
    const data = await extractImageFromIframe(iframe);
    if (data) {
      images.push({ index: i - beforeCount, data });
      log(`Extracted image ${images.length}/${count} from iframe[${i}]`);
    } else {
      log(`Could not extract image from iframe[${i}]`);
    }
  }

  if (images.length === 0) {
    log("No images from iframes, trying #outputAreaEl img fallback");
    const imgs = document.querySelectorAll("#outputAreaEl img");
    for (let i = beforeCount; i < beforeCount + count && i < imgs.length; i++) {
      const src = (imgs[i] as HTMLImageElement).src;
      if (src.startsWith("data:")) {
        images.push({ index: i - beforeCount, data: src });
      } else {
        try {
          const resp = await fetch(src);
          const blob = await resp.blob();
          const data = await new Promise<string>((res) => {
            const rd = new FileReader();
            rd.onload = () => res(rd.result as string);
            rd.readAsDataURL(blob);
          });
          images.push({ index: i - beforeCount, data });
        } catch {
          log("Image fetch failed");
        }
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

    const positiveStr = String(item.positive);
    const negativeStr = String(item.negative || "");

    fillTextarea('textarea[data-name="description"]', positiveStr);

    if (negativeStr) {
      const neg = document.querySelector('textarea[data-name="negative"]') as HTMLTextAreaElement | null;
      if (neg) {
        const ctn = neg.closest(".input-ctn") as HTMLElement | null;
        if (ctn && ctn.dataset.foldToggleState === "hidden") {
          ctn.dataset.foldToggleState = "shown";
          await new Promise((r) => setTimeout(r, 500));
        }
        fillTextarea('textarea[data-name="negative"]', negativeStr);
      }
    }

    await new Promise((r) => setTimeout(r, 500));

    const beforeCount = countOutputImages();
    log(`Clicking Generate (before: ${beforeCount} images)...`);
    setIndicator("darkgreen", `[SBDC] Generating ${item.target_card}...`);
    document.querySelector("#generateButtonEl")!.click();

    const loaded = await waitForImagesToLoad(beforeCount, NUM_IMAGES);
    if (!loaded) {
      log("Image load timeout, moving to next prompt");
      continue;
    }

    log("Extracting images...");
    const images = await extractImagesFromOutput(beforeCount, NUM_IMAGES);
    log(`Extracted ${images.length}/${NUM_IMAGES} images`);

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
      log("No images extracted — skipping submission for this prompt");
      try {
        const resultUrl = `/api/decks/${deckId}/prompts/${item.prompt_id}/takes`;
        await serverFetch(resultUrl, "POST", JSON.stringify({ images: [] as ImageData[] }));
        log("Submitted empty takes to mark prompt as processed");
      } catch {
        // ignore
      }
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
