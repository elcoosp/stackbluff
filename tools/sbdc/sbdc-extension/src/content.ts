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
  el.dispatchEvent(new Event("change", { bubbles: true }));

  setNativeValue(el, value);

  el.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    cancelable: false,
    data: value,
    inputType: "insertText",
  }));
  el.dispatchEvent(new Event("change", { bubbles: true }));

  const actualValue = el.value;
  if (actualValue !== value) {
    log(`WARNING: value mismatch! Set ${value.length} chars, got ${actualValue.length}`);
    log(`  Expected: "${value.substring(0, 100)}..."`);
    log(`  Got:      "${actualValue.substring(0, 100)}..."`);
  }

  return true;
}

async function waitForUI(): Promise<boolean> {
  for (let i = 0; i < 120; i++) {
    const desc = document.querySelector('textarea[data-name="description"]');
    const genBtn = document.querySelector("#generateButtonEl");

    if (i === 0) {
      log(`Scanning ${FRAME_ID}...`);
      log(`  textarea[data-name="description"]: ${desc ? "FOUND" : "not found"}`);
      log(`  #generateButtonEl: ${genBtn ? "FOUND" : "not found"}`);
      log(`  URL: ${window.location.href}`);
      document.querySelectorAll("textarea").forEach((t, idx) => {
        if (idx < 5) {
          log(`  ta[${idx}]: data-name="${t.getAttribute("data-name")}" id="${t.id}"`);
        }
      });
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
    } catch (e: Error) {
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

    log(`=== PROMPT ${item.prompt_id} (${item.target_card}/${item.target_layer}) ===`);

    log(`TYPE OF positive: ${typeof item.positive}`);
    log(`POSITIVE (${item.positive.length} chars): "${item.positive.substring(0, 200)}"`);
    log(`NEGATIVE (${item.negative?.length || 0} chars): "${(item.negative || "").substring(0, 200)}"`);

    const positiveStr = String(item.positive);
    const negativeStr = String(item.negative || "");

    setIndicator("green", `[SBDC] ${item.target_card}/${item.target_layer}`);

    const ns = document.querySelector('select[data-name="numImages"]') as HTMLSelectElement | null;
    if (ns) {
      ns.value = String(NUM_IMAGES);
      ns.dispatchEvent(new Event("change", { bubbles: true }));
    }

    fillTextarea('textarea[data-name="description"]', positiveStr);

    const verifyEl = document.querySelector('textarea[data-name="description"]') as HTMLTextAreaElement | null;
    if (verifyEl) {
      log(`VERIFY textarea value (${verifyEl.value.length} chars): "${verifyEl.value.substring(0, 200)}"`);
      if (verifyEl.value !== positiveStr) {
        log(`MISMATCH! textarea has ${verifyEl.value.length} chars, expected ${positiveStr.length}`);
      }
    } else {
      log("VERIFY: textarea not found after fill!");
    }

    if (negativeStr) {
      const neg = document.querySelector('textarea[data-name="negative"]') as HTMLTextAreaElement | null;
      if (neg) {
        const ctn = neg.closest(".input-ctn") as HTMLElement | null;
        if (ctn && ctn.dataset.foldToggleState === "hidden") {
          ctn.dataset.foldToggleState = "shown";
          await new Promise((r) => setTimeout(r, 500));
        }
        fillTextarea('textarea[data-name="negative"]', negativeStr);
        log(`Negative set (${neg.value.length} chars)`);
      } else {
        log("Negative textarea not found");
      }
    }

    await new Promise((r) => setTimeout(r, 500));

    const before = document.querySelectorAll("#outputAreaEl img").length;
    log(`Clicking Generate (before: ${before})...`);
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
