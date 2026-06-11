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
  serverUrl?: string;
}

function log(m: string): void {
  const line = `[SBDC] ${m}`;
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
      document.body.appendChild(ind);
    }
    ind.style.background = color;
    ind.textContent = text;
  } catch {
    // ignore
  }
}

function querySelector<T extends Element>(selectors: string[]): T | null {
  for (const sel of selectors) {
    const el = document.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
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

function findUI(): {
  desc: HTMLTextAreaElement | null;
  neg: HTMLTextAreaElement | null;
  genBtn: HTMLElement | null;
  numSelect: HTMLSelectElement | null;
} {
  const desc = querySelector<HTMLTextAreaElement>([
    'textarea[data-name="description"]',
    "textarea.prompt-textarea",
    "textarea",
  ]);

  const neg = querySelector<HTMLTextAreaElement>([
    'textarea[data-name="negative"]',
    'textarea[data-name="negativePrompt"]',
  ]);

  const genBtn = querySelector<HTMLElement>([
    "#generateButtonEl",
    'button[data-action="generate"]',
    "button.generate-btn",
  ]);

  const numSelect = querySelector<HTMLSelectElement>([
    'select[data-name="numImages"]',
    "select.num-images",
  ]);

  return { desc, neg, genBtn, numSelect };
}

function fillTextarea(el: HTMLTextAreaElement, value: string): boolean {
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
    const { desc, genBtn } = findUI();

    if (i === 0) {
      log("Looking for UI elements...");
      log(`  textarea: ${desc ? "FOUND" : "not found"}`);
      log(`  generateBtn: ${genBtn ? "FOUND" : "not found"}`);
      log(`  URL: ${window.location.href}`);
      log(`  all textareas: ${document.querySelectorAll("textarea").length}`);
      log(`  all buttons: ${document.querySelectorAll("button").length}`);
      document.querySelectorAll("button").forEach((b, idx) => {
        if (idx < 10) {
          log(`  button[${idx}]: id="${b.id}" text="${b.textContent?.substring(0, 30)}"`);
        }
      });
      document.querySelectorAll("textarea").forEach((t, idx) => {
        if (idx < 10) {
          const name = t.getAttribute("data-name") || "";
          log(`  textarea[${idx}]: data-name="${name}" id="${t.id}"`);
        }
      });
    }

    if (desc && genBtn) {
      log(`UI found after ${i}s`);
      return true;
    }

    if (i % 5 === 0) {
      log(`Waiting for UI... (${i}s)`);
      setIndicator("red", `[SBDC] Waiting for UI... (${i}s)`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  log("No UI found after 120s. Giving up.");
  setIndicator("orange", "[SBDC] No generator UI found");
  return false;
}

async function runGeneration(): Promise<void> {
  const deckId = await getDeckId();
  if (!deckId) {
    log("No deck ID set — waiting for popup configuration...");
    setIndicator("orange", "[SBDC] Configure in popup first");
    return;
  }

  log(`Starting generation for deck: ${deckId}`);

  let ready = false;
  while (!ready) {
    try {
      const status = (await serverFetch(`/api/decks/${deckId}/status`)) as StatusData;
      log(`Status: total=${status.total_prompts} ready=${status.ready_to_generate} status=${status.status}`);

      if (status.ready_to_generate > 0) {
        ready = true;
        log(`${status.ready_to_generate} prompts ready!`);
        setIndicator("green", `[SBDC] ${status.ready_to_generate} prompts! Starting...`);
      } else if (status.status === "generating" && status.generating > 0) {
        ready = true;
        log(`Generation in progress, ${status.generating} being processed`);
        setIndicator("green", "[SBDC] Resuming generation...");
      } else {
        log("No prompts ready. Click 'Start' in the extension popup!");
        setIndicator("orange", "[SBDC] Click Start in popup!");
      }
    } catch (e: Error) {
      log(`Server not reachable: ${e.message}`);
      setIndicator("darkred", "[SBDC] Server unreachable");
    }
    if (!ready) await new Promise((r) => setTimeout(r, 3000));
  }

  const { desc, neg, genBtn, numSelect } = findUI();
  if (!desc || !genBtn) {
    log("UI disappeared!");
    setIndicator("red", "[SBDC] UI lost");
    return;
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
      log("No more prompts ready");
      setIndicator("blue", "[SBDC] All prompts processed!");
      break;
    }

    if (!item || !item.prompt_id) {
      log("All prompts complete!");
      setIndicator("blue", "[SBDC] ✅ ALL DONE!");
      break;
    }

    log(`Generating: ${item.target_card}/${item.target_layer} (prompt_id=${item.prompt_id})`);
    setIndicator("green", `[SBDC] ${item.target_card}/${item.target_layer}`);

    const statusResp = (await serverFetch(`/api/decks/${deckId}/status`)) as StatusData;
    const numImages = statusResp?.takes_per_prompt > 0 ? statusResp.takes_per_prompt : 4;

    if (numSelect) {
      numSelect.value = String(numImages);
      numSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    fillTextarea(desc, item.positive);
    log(`Positive set: "${desc.value.substring(0, 80)}..."`);

    if (item.negative && neg) {
      const ctn = neg.closest(".input-ctn") as HTMLElement | null;
      if (ctn && ctn.dataset.foldToggleState === "hidden") {
        ctn.dataset.foldToggleState = "shown";
        await new Promise((r) => setTimeout(r, 300));
      }
      fillTextarea(neg, item.negative);
      log("Negative set.");
    }

    const before = document.querySelectorAll("#outputAreaEl img").length;
    log(`Clicking Generate (expecting ${numImages} images, before: ${before})...`);
    setIndicator("darkgreen", `[SBDC] Generating ${item.target_card}...`);
    genBtn.click();

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
      log(`Takes submitted for prompt ${item.prompt_id} (${images.length} images)`);
    } catch (e: Error) {
      log(`Submit failed: ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
  }
}

async function main(): Promise<void> {
  log("Content script loaded");
  log(`URL: ${window.location.href}`);
  log(`Frame: ${window === window.top ? "TOP" : "IFRAME"}`);

  if (window !== window.top) {
    log("Skipping iframe — only running in top frame");
    return;
  }

  setIndicator("red", "[SBDC] Loading...");

  if (!(await waitForUI())) return;

  setIndicator("green", "[SBDC] UI ready! Checking config...");

  const deckId = await getDeckId();
  if (deckId) {
    log(`Deck ID from storage: ${deckId}`);
    await runGeneration();
  } else {
    log("No deck ID configured yet. Waiting for popup...");
    setIndicator("orange", "[SBDC] Open popup to configure");

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
  setIndicator("red", `[SBDC] Error: ${e.message}`);
});
