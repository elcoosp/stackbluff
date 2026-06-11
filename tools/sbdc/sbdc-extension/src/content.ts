// content.ts - runs in ALL frames (top and iframes)
const frameType = window === window.top ? 'top' : 'iframe';
console.log(`[SBDC] Content script in ${frameType} frame: ${window.location.href}`);

// Function to check if this frame is the fluxgen UI
function isFluxgenFrame(): boolean {
  return !!document.querySelector('textarea[data-name="description"]');
}

// If this is the UI frame, listen for START_POLLING directly
if (isFluxgenFrame()) {
  console.log('[SBDC] This is the fluxgen UI frame - ready for automation');
  let pollingActive = false;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[SBDC UI] Received message:', msg);
    if (msg.type === 'START_POLLING') {
      pollingActive = true;
      pollLoop().catch(console.error);
      sendResponse({ status: 'started' });
      return true;
    }
    if (msg.type === 'PING') {
      sendResponse({ status: 'alive' });
      return true;
    }
    return false;
  });

  async function pollLoop() {
    console.log('[SBDC UI] Poll loop started');
    while (pollingActive) {
      const task = await chrome.runtime.sendMessage({ type: 'GET_NEXT_PROMPT' });
      console.log('[SBDC UI] Task:', task);
      if (!task || task.status === 'DONE') {
        pollingActive = false;
        break;
      }

      try {
        // Fill description
        const desc = document.querySelector('textarea[data-name="description"]') as HTMLTextAreaElement;
        if (desc) {
          desc.value = task.positive;
          desc.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('[SBDC UI] Positive set');
        }

        // Fill negative if present
        if (task.negative) {
          const neg = document.querySelector('textarea[data-name="negative"]') as HTMLTextAreaElement;
          if (neg) {
            // Expand container if collapsed
            const container = neg.closest('.input-ctn');
            if (container?.dataset.foldToggleState === 'hidden') {
              container.dataset.foldToggleState = 'shown';
              await new Promise(r => setTimeout(r, 200));
            }
            neg.value = task.negative;
            neg.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('[SBDC UI] Negative set');
          }
        }

        // Set shape
        const shapeSelect = document.querySelector('select[data-name="shape"]') as HTMLSelectElement;
        if (shapeSelect && task.shape) {
          shapeSelect.value = task.shape;
          shapeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Click generate
        const generateBtn = document.querySelector('#generateButtonEl') as HTMLElement;
        if (!generateBtn) throw new Error('Generate button not found');
        generateBtn.click();
        console.log('[SBDC UI] Clicked generate');

        // Wait for images
        const outputArea = document.querySelector('#outputAreaEl');
        let images: string[] = [];
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 500));
          const imgs = outputArea?.querySelectorAll('img') || [];
          if (imgs.length > 0 && Array.from(imgs).every(img => img.complete && img.naturalHeight > 0)) {
            images = Array.from(imgs).map(img => img.src);
            console.log(`[SBDC UI] Captured ${images.length} images`);
            break;
          }
        }

        if (images.length === 0) {
          console.warn('[SBDC UI] No images captured');
          // Still submit empty to continue
        }

        await chrome.runtime.sendMessage({
          type: 'SUBMIT_RESULT',
          promptId: task.prompt_id,
          images,
          take: task.take,
        });

        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
      } catch (err) {
        console.error('[SBDC UI] Error:', err);
        pollingActive = false;
      }
    }
  }
} else if (frameType === 'top') {
  // Top frame: forward START_POLLING to the iframe
  console.log('[SBDC] Top frame - will forward START_POLLING to iframe');
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'START_POLLING') {
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        // Send a custom event to the iframe's window
        iframe.contentWindow.postMessage({ type: 'START_POLLING' }, '*');
        console.log('[SBDC] Forwarded START_POLLING to iframe');
        sendResponse({ ok: true });
      } else {
        console.error('[SBDC] No iframe found');
        sendResponse({ error: 'no iframe' });
      }
      return true;
    }
    return false;
  });

  // Listen for messages from iframe (if needed)
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'FORWARD_TO_BACKGROUND') {
      chrome.runtime.sendMessage(event.data.payload);
    }
  });
}
