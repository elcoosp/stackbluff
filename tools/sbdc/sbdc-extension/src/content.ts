// Log immediately
console.log('[CT] script loaded', window.location.href);

let pollingActive = false;
let currentTake = 1;

// Identify if this frame is the main fluxgen UI (contains generation controls)
function isFluxgenFrame(): boolean {
  return !!document.querySelector('textarea[data-name="description"]');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[CT] received', msg);
  if (msg.type === 'PING') {
    sendResponse({ status: 'alive' });
    return true;
  }
  if (msg.type === 'START_POLLING') {
    if (!isFluxgenFrame()) {
      console.log('[CT] Not fluxgen frame, ignoring');
      sendResponse({ status: 'ignored' });
      return true;
    }
    console.log('[CT] Starting polling in correct frame');
    pollingActive = true;
    pollLoop().catch(console.error);
    sendResponse({ status: 'started' });
    return true;
  }
  return false;
});

async function pollLoop() {
  while (pollingActive) {
    console.log('[CT] requesting next prompt');
    const task = await chrome.runtime.sendMessage({ type: 'GET_NEXT_PROMPT' });
    console.log('[CT] task:', task);
    if (!task || task.status === 'DONE') {
      pollingActive = false;
      break;
    }

    try {
      // Fill prompt
      const desc = document.querySelector('textarea[data-name="description"]') as HTMLTextAreaElement;
      if (desc) {
        desc.value = task.positive;
        desc.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('[CT] set positive');
      }

      if (task.negative) {
        const neg = document.querySelector('textarea[data-name="negative"]') as HTMLTextAreaElement;
        if (neg) {
          // Expand negative container if needed
          const container = neg.closest('.input-ctn');
          if (container?.dataset.foldToggleState === 'hidden') {
            container.dataset.foldToggleState = 'shown';
          }
          neg.value = task.negative;
          neg.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('[CT] set negative');
        }
      }

      const shapeSelect = document.querySelector('select[data-name="shape"]') as HTMLSelectElement;
      if (shapeSelect && task.shape) {
        shapeSelect.value = task.shape;
        shapeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Click generate
      const generateBtn = document.querySelector('#generateButtonEl') as HTMLElement;
      if (!generateBtn) throw new Error('Generate button not found');
      generateBtn.click();
      console.log('[CT] clicked generate');

      // Wait for images to appear
      const outputArea = document.querySelector('#outputAreaEl');
      let images: string[] = [];
      for (let i = 0; i < 60; i++) { // max 30 seconds
        await new Promise(r => setTimeout(r, 500));
        const imgs = outputArea?.querySelectorAll('img') || [];
        if (imgs.length > 0 && Array.from(imgs).every(img => img.complete && img.naturalHeight > 0)) {
          images = Array.from(imgs).map(img => img.src);
          console.log(`[CT] captured ${images.length} images`);
          break;
        }
      }

      if (images.length === 0) {
        console.warn('[CT] No images captured');
      }

      await chrome.runtime.sendMessage({
        type: 'SUBMIT_RESULT',
        promptId: task.prompt_id,
        images,
        take: task.take,
      });

      await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
    } catch (err) {
      console.error('[CT] error:', err);
      pollingActive = false;
    }
  }
}
