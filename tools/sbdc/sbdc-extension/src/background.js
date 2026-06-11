let currentSessionId = null;
let serverUrl = 'http://localhost:8899';

chrome.storage.local.get(['serverUrl'], (res) => {
  if (res.serverUrl) serverUrl = res.serverUrl;
  console.log('[BG] Loaded serverUrl:', serverUrl);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[BG] Received:', msg);
  if (msg.type === 'SET_SERVER_URL') {
    serverUrl = msg.url;
    chrome.storage.local.set({ serverUrl });
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'START_GENERATION') {
    startGeneration(msg.deckId, msg.takes).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'AUTOMATION_READY') {
    console.log('[BG] Automation script ready');
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'GET_NEXT_PROMPT') {
    getNextPrompt().then(sendResponse);
    return true;
  }
  if (msg.type === 'SUBMIT_RESULT') {
    submitResult(msg.promptId, msg.images, msg.take).then(sendResponse);
    return true;
  }
  return false;
});

async function startGeneration(deckId, takes) {
  console.log(`[BG] Starting deck=${deckId} takes=${takes}`);
  try {
    const res = await fetch(`${serverUrl}/start/${deckId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takes })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    currentSessionId = data.session_id;
    console.log('[BG] Session ID:', currentSessionId);

    // Find or open perchance tab
    let tabs = await chrome.tabs.query({ url: 'https://perchance.org/fluxgen*' });
    if (tabs.length === 0) {
      tabs = await chrome.tabs.create({ url: 'https://perchance.org/fluxgen' });
      await new Promise(r => setTimeout(r, 5000));
    }
    const tabId = tabs[0].id;
    console.log(`[BG] Using tab ${tabId}`);

    // Inject automation script into the page (not iframe)
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: injectAutomation,
      args: [serverUrl, currentSessionId]
    });
    console.log('[BG] Injected automation script');
  } catch (err) {
    console.error('[BG] startGeneration error:', err);
  }
}

function injectAutomation(baseUrl, sessionId) {
  // This function runs in the page context
  (async () => {
    console.log('[AUTO] Automation script started');
    // Find the iframe
    let iframe = document.querySelector('iframe');
    while (!iframe) {
      await new Promise(r => setTimeout(r, 500));
      iframe = document.querySelector('iframe');
    }
    console.log('[AUTO] Iframe found:', iframe.src);
    // Access iframe content
    let doc;
    try {
      doc = iframe.contentDocument || iframe.contentWindow.document;
      if (!doc) throw new Error('Cannot access iframe');
    } catch (e) {
      console.error('[AUTO] Cannot access iframe:', e);
      return;
    }
    // Now we are inside the iframe's context? Actually doc is the iframe's document.
    // We need to run automation inside the iframe's window. We'll inject a script into the iframe.
    const script = doc.createElement('script');
    script.textContent = `
      (async function() {
        const SERVER_URL = "${baseUrl}";
        const SESSION_ID = "${sessionId}";
        console.log('[IFRAME] Automation started, session', SESSION_ID);

        async function fetchNext() {
          const res = await fetch(SERVER_URL + '/next/' + SESSION_ID);
          return res.json();
        }
        async function submitResult(promptId, images, take) {
          await fetch(SERVER_URL + '/result/' + SESSION_ID, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt_id: promptId, images, take })
          });
        }
        function setTextarea(sel, val) {
          const el = document.querySelector(sel);
          if (!el) return false;
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        while (true) {
          const task = await fetchNext();
          if (!task || task.status === 'DONE') break;
          console.log('[IFRAME] Processing prompt', task.prompt_id);
          setTextarea('textarea[data-name="description"]', task.positive);
          if (task.negative) {
            const neg = document.querySelector('textarea[data-name="negative"]');
            if (neg) {
              const ctn = neg.closest('.input-ctn');
              if (ctn?.dataset.foldToggleState === 'hidden') ctn.dataset.foldToggleState = 'shown';
              setTextarea('textarea[data-name="negative"]', task.negative);
            }
          }
          const shape = document.querySelector('select[data-name="shape"]');
          if (shape && task.shape) shape.value = task.shape;
          document.querySelector('#generateButtonEl').click();
          // Wait for images
          const output = document.querySelector('#outputAreaEl');
          let imgs = [];
          for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 500));
            const current = output?.querySelectorAll('img') || [];
            if (current.length > 0 && Array.from(current).every(img => img.complete && img.naturalHeight > 0)) {
              imgs = Array.from(current).map(img => img.src);
              break;
            }
          }
          if (imgs.length) {
            const imagesData = imgs.map(src => ({ data: src }));
            await submitResult(task.prompt_id, imagesData, task.take);
          }
          await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
        }
        console.log('[IFRAME] Automation finished');
      })();
    `;
    doc.body.appendChild(script);
    console.log('[AUTO] Injected script into iframe');
  })();
}

async function getNextPrompt() {
  if (!currentSessionId) return null;
  const res = await fetch(`${serverUrl}/next/${currentSessionId}`);
  return res.ok ? res.json() : null;
}

async function submitResult(promptId, images, take) {
  if (!currentSessionId) return;
  await fetch(`${serverUrl}/result/${currentSessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt_id: promptId, images, take })
  });
}
