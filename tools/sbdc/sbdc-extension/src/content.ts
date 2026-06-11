let polling = false;

// Log that content script is loaded
console.log('[SBDC] Content script loaded on', window.location.href);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[SBDC] Received message:', msg);
  if (msg.type === 'START_POLLING') {
    console.log('[SBDC] Starting polling');
    polling = true;
    pollLoop();
    sendResponse({ status: 'started' });
    return true;
  }
  // Keep for debugging
  return false;
});

async function pollLoop() {
  console.log('[SBDC] Poll loop started');
  while (polling) {
    console.log('[SBDC] Requesting next prompt...');
    const task = await chrome.runtime.sendMessage({ type: 'GET_NEXT_PROMPT' });
    console.log('[SBDC] Received task:', task);
    if (!task || task.status === 'DONE') {
      console.log('[SBDC] Generation complete or no prompts');
      polling = false;
      break;
    }

    // Wait for iframe to be available
    let iframe = document.querySelector('iframe');
    let retries = 0;
    while (!iframe && retries < 20) {
      console.log('[SBDC] Waiting for iframe...');
      await new Promise(r => setTimeout(r, 500));
      iframe = document.querySelector('iframe');
      retries++;
    }
    if (!iframe) {
      console.error('[SBDC] No iframe found!');
      polling = false;
      break;
    }
    console.log('[SBDC] Iframe found:', iframe.src);

    let doc;
    try {
      doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        console.error('[SBDC] Cannot access iframe document (cross-origin?)');
        polling = false;
        break;
      }
    } catch (e) {
      console.error('[SBDC] Error accessing iframe:', e);
      polling = false;
      break;
    }

    console.log('[SBDC] Waiting for textarea...');
    await waitForElement(doc, 'textarea[data-name="description"]', 30);
    console.log('[SBDC] Filling positive prompt...');
    setTextarea(doc, 'textarea[data-name="description"]', task.positive);
    if (task.negative) {
      expandNegative(doc);
      setTextarea(doc, 'textarea[data-name="negative"]', task.negative);
    }

    const shapeSelect = doc.querySelector('select[data-name="shape"]');
    if (shapeSelect && task.shape) {
      shapeSelect.value = task.shape;
      shapeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    console.log('[SBDC] Clicking generate button...');
    const generateBtn = doc.querySelector('#generateButtonEl') as HTMLElement;
    if (!generateBtn) {
      console.error('[SBDC] Generate button not found');
      break;
    }
    generateBtn.click();

    const outputArea = doc.querySelector('#outputAreaEl');
    const initialImgs = outputArea?.querySelectorAll('img').length || 0;
    console.log('[SBDC] Waiting for images...');
    await waitForImages(doc, initialImgs + 1);

    const images = await collectNewImages(doc, initialImgs);
    console.log(`[SBDC] Collected ${images.length} images`);

    await chrome.runtime.sendMessage({
      type: 'SUBMIT_RESULT',
      promptId: task.prompt_id,
      images,
      take: task.take,
    });

    console.log('[SBDC] Waiting before next prompt...');
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
  }
  console.log('[SBDC] Poll loop ended');
}

function setTextarea(doc: Document, selector: string, value: string) {
  const el = doc.querySelector(selector) as HTMLTextAreaElement;
  if (!el) {
    console.warn(`[SBDC] Textarea ${selector} not found`);
    return;
  }
  el.focus();
  document.execCommand('insertText', false, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  console.log(`[SBDC] Set ${selector} to ${value.substring(0, 50)}...`);
}

function expandNegative(doc: Document) {
  const container = doc.querySelector('textarea[data-name="negative"]')?.closest('.input-ctn');
  if (container?.dataset.foldToggleState === 'hidden') {
    container.dataset.foldToggleState = 'shown';
    console.log('[SBDC] Expanded negative container');
  }
}

async function waitForElement(doc: Document, selector: string, maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    if (doc.querySelector(selector)) return;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Element ${selector} not found after ${maxRetries} retries`);
}

async function waitForImages(doc: Document, minCount: number): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const imgs = doc.querySelectorAll('#outputAreaEl img');
      if (imgs.length >= minCount && [...imgs].every(img => img.complete && img.naturalHeight > 0)) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
  });
}

async function collectNewImages(doc: Document, previousCount: number): Promise<string[]> {
  const imgs = doc.querySelectorAll('#outputAreaEl img');
  const newImages: string[] = [];
  for (let i = previousCount; i < imgs.length; i++) {
    const src = imgs[i].src;
    if (src.startsWith('data:')) {
      newImages.push(src);
    } else {
      const blob = await fetch(src).then(r => r.blob());
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      newImages.push(data);
    }
  }
  return newImages;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING') {
    console.log('[SBDC Content] Pong');
    sendResponse({ status: 'alive' });
    return true;
  }
});
