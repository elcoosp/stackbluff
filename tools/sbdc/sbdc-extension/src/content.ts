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
