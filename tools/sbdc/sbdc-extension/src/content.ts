console.log("[SBDC] Top-level content script loaded at", window.location.href);
let polling = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[SBDC] Content script received message:", msg);
  if (msg.type === "START_POLLING") {
    polling = true;
    // Start in top frame; will find iframe and run inside it
    findAndRunInIframe().catch(err => console.error("[SBDC] Error:", err));
    sendResponse({ status: "started" });
  }
  return true;
});

async function findAndRunInIframe() {
  console.log("[SBDC] Looking for iframe...");
  let iframe = document.querySelector("iframe");
  let attempts = 0;
  while (!iframe && attempts < 20) {
    await new Promise(r => setTimeout(r, 500));
    iframe = document.querySelector("iframe");
    attempts++;
    console.log(`[SBDC] Iframe attempt ${attempts}: ${iframe ? "found" : "not found"}`);
  }
  if (!iframe) {
    console.error("[SBDC] No iframe found on page!");
    return;
  }
  console.log("[SBDC] Iframe src:", iframe.src);

  // Wait for iframe to load
  await new Promise(resolve => {
    if (iframe.contentDocument && iframe.contentDocument.readyState === "complete") {
      resolve();
    } else {
      iframe.addEventListener("load", resolve, { once: true });
    }
  });
  console.log("[SBDC] Iframe loaded");

  let iframeDoc = iframe.contentDocument;
  if (!iframeDoc) {
    console.error("[SBDC] Cannot access iframe document (cross-origin?)");
    return;
  }

  // Now run the automation inside the iframe
  await runAutomation(iframeDoc);
}

async function runAutomation(doc: Document) {
  console.log("[SBDC] Running automation inside iframe");
  while (polling) {
    console.log("[SBDC] Requesting next prompt...");
    const task = await chrome.runtime.sendMessage({ type: "GET_NEXT_PROMPT" });
    console.log("[SBDC] Received task:", JSON.stringify(task));
    if (!task || task.status === "DONE") {
      console.log("[SBDC] No more prompts, stopping");
      polling = false;
      break;
    }

    console.log("[SBDC] Waiting for description textarea...");
    let desc = doc.querySelector('textarea[data-name="description"]');
    let retries = 0;
    while (!desc && retries < 20) {
      await new Promise(r => setTimeout(r, 300));
      desc = doc.querySelector('textarea[data-name="description"]');
      retries++;
      console.log(`[SBDC] Textarea attempt ${retries}: ${desc ? "found" : "not found"}`);
    }
    if (!desc) {
      console.error("[SBDC] Could not find description textarea!");
      break;
    }

    console.log("[SBDC] Filling positive prompt...");
    desc.value = task.positive;
    desc.dispatchEvent(new Event("input", { bubbles: true }));

    if (task.negative) {
      let neg = doc.querySelector('textarea[data-name="negative"]') as HTMLTextAreaElement;
      if (neg) {
        const container = neg.closest(".input-ctn") as HTMLElement;
        if (container?.dataset.foldToggleState === "hidden") {
          container.dataset.foldToggleState = "shown";
        }
        neg.value = task.negative;
        neg.dispatchEvent(new Event("input", { bubbles: true }));
        console.log("[SBDC] Filled negative prompt");
      }
    }

    const shapeSelect = doc.querySelector('select[data-name="shape"]') as HTMLSelectElement;
    if (shapeSelect && task.shape) {
      shapeSelect.value = task.shape;
      shapeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      console.log("[SBDC] Set shape to", task.shape);
    }

    console.log("[SBDC] Clicking generate button...");
    const generateBtn = doc.querySelector("#generateButtonEl") as HTMLElement;
    if (!generateBtn) {
      console.error("[SBDC] Generate button not found!");
      break;
    }
    generateBtn.click();

    // Wait for images
    const outputArea = doc.querySelector("#outputAreaEl");
    let images: string[] = [];
    let waitSecs = 0;
    while (waitSecs < 60) {
      await new Promise(r => setTimeout(r, 1000));
      const imgs = outputArea?.querySelectorAll("img") || [];
      if (imgs.length > 0 && Array.from(imgs).every(img => img.complete && img.naturalHeight > 0)) {
        images = Array.from(imgs).map(img => img.src);
        console.log(`[SBDC] Captured ${images.length} images after ${waitSecs+1}s`);
        break;
      }
      waitSecs++;
    }

    if (images.length === 0) {
      console.warn("[SBDC] No images captured, continuing anyway");
    }

    await chrome.runtime.sendMessage({
      type: "SUBMIT_RESULT",
      promptId: task.prompt_id,
      images,
      take: task.take,
    });

    console.log("[SBDC] Submitted result, waiting before next prompt...");
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
  }
  console.log("[SBDC] Automation loop ended");
}
