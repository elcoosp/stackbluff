console.log('[CT] Content script loaded', window.location.href, 'frame depth:', window !== window.top ? 'iframe' : 'top');

let pollingActive = false;

function isFluxgenFrame(): boolean {
  const hasTextarea = !!document.querySelector('textarea[data-name="description"]');
  console.log('[CT] isFluxgenFrame check:', hasTextarea);
  return hasTextarea;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[CT] Received message:', msg.type, msg);
  if (msg.type === 'PING') {
    console.log('[CT] Pong response');
    sendResponse({ status: 'alive', url: window.location.href, isFluxgen: isFluxgenFrame() });
    return true;
  }
  if (msg.type === 'START_POLLING') {
    console.log('[CT] START_POLLING received, isFluxgenFrame?', isFluxgenFrame());
    if (!isFluxgenFrame()) {
      console.warn('[CT] Not the correct frame, ignoring START_POLLING');
      sendResponse({ status: 'ignored', reason: 'not fluxgen frame' });
      return true;
    }
    pollingActive = true;
    pollLoop().catch(console.error);
    sendResponse({ status: 'started' });
    return true;
  }
  if (msg.type === 'MANUAL_FILL') {
    console.log('[CT] MANUAL_FILL received:', msg.prompt);
    fillPrompt(msg.prompt);
    sendResponse({ status: 'filled' });
    return true;
  }
  console.warn('[CT] Unhandled message type:', msg.type);
  return false;
});

async function fillPrompt(task: any) {
  console.log('[CT] fillPrompt called with task:', task);
  const desc = document.querySelector('textarea[data-name="description"]') as HTMLTextAreaElement;
  if (desc) {
    desc.value = task.positive;
    desc.dispatchEvent(new Event('input', { bubbles: true }));
    console.log('[CT] Positive set:', task.positive.substring(0, 50));
  } else {
    console.error('[CT] textarea not found!');
  }

  if (task.negative) {
    const neg = document.querySelector('textarea[data-name="negative"]') as HTMLTextAreaElement;
    if (neg) {
      const container = neg.closest('.input-ctn');
      if (container?.dataset.foldToggleState === 'hidden') {
        container.dataset.foldToggleState = 'shown';
        console.log('[CT] Expanded negative container');
      }
      neg.value = task.negative;
      neg.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('[CT] Negative set');
    }
  }

  const shapeSelect = document.querySelector('select[data-name="shape"]') as HTMLSelectElement;
  if (shapeSelect && task.shape) {
    shapeSelect.value = task.shape;
    shapeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('[CT] Shape set to', task.shape);
  }
}

async function pollLoop() {
  console.log('[CT] Poll loop started');
  while (pollingActive) {
    console.log('[CT] Requesting next prompt from background...');
    let task;
    try {
      task = await chrome.runtime.sendMessage({ type: 'GET_NEXT_PROMPT' });
      console.log('[CT] Received task:', task);
    } catch (err) {
      console.error('[CT] Failed to get next prompt:', err);
      pollingActive = false;
      break;
    }

    if (!task || task.status === 'DONE') {
      console.log('[CT] No more tasks or DONE');
      pollingActive = false;
      break;
    }

    try {
      await fillPrompt(task);

      const generateBtn = document.querySelector('#generateButtonEl') as HTMLElement;
      if (!generateBtn) {
        console.error('[CT] Generate button not found');
        pollingActive = false;
        break;
      }
      console.log('[CT] Clicking generate button...');
      generateBtn.click();

      // Wait for images
      console.log('[CT] Waiting for images...');
      const outputArea = document.querySelector('#outputAreaEl');
      let images: string[] = [];
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 500));
        const imgs = outputArea?.querySelectorAll('img') || [];
        if (imgs.length > 0 && Array.from(imgs).every(img => img.complete && img.naturalHeight > 0)) {
          images = Array.from(imgs).map(img => img.src);
          console.log(`[CT] Found ${images.length} images`);
          break;
        }
      }
      if (images.length === 0) console.warn('[CT] No images captured');

      console.log('[CT] Submitting result...');
      await chrome.runtime.sendMessage({
        type: 'SUBMIT_RESULT',
        promptId: task.prompt_id,
        images,
        take: task.take,
      });

      console.log('[CT] Waiting before next prompt...');
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
    } catch (err) {
      console.error('[CT] Error in pollLoop iteration:', err);
      pollingActive = false;
    }
  }
  console.log('[CT] Poll loop ended');
}
