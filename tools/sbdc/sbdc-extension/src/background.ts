let currentSessionId: string | null = null;
let serverUrl = 'http://localhost:8899';
let injectedTabId: number | null = null;

chrome.storage.local.get(['serverUrl'], (res) => {
  if (res.serverUrl) serverUrl = res.serverUrl;
  console.log('[SBDC] Background: serverUrl =', serverUrl);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[SBDC] Background received:', msg);
  if (msg.type === 'START_GENERATION') {
    startGeneration(msg.deckId, msg.takes).then(() => sendResponse({ ok: true }));
    return true;
  } else if (msg.type === 'GET_NEXT_PROMPT') {
    getNextPrompt().then(sendResponse);
    return true;
  } else if (msg.type === 'SUBMIT_RESULT') {
    submitResult(msg.promptId, msg.images, msg.take).then(sendResponse);
    return true;
  } else if (msg.type === 'SET_SERVER_URL') {
    serverUrl = msg.url;
    chrome.storage.local.set({ serverUrl });
    sendResponse({ ok: true });
  } else if (msg.type === 'INJECTION_READY') {
    // Automation script inside iframe is ready
    console.log('[SBDC] Automation script ready in iframe');
    startPollingInIframe(sender.tab!.id, sender.frameId);
    sendResponse({ ok: true });
    return true;
  } else if (msg.type === 'IFRAME_LOG') {
    console.log('[SBDC][iframe]', msg.message);
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

async function startGeneration(deckId: string, takes: number) {
  console.log(`[SBDC] Start gen deck=${deckId} takes=${takes}`);
  try {
    // Start session
    const res = await fetch(`${serverUrl}/start/${deckId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takes }),
    });
    if (!res.ok) throw new Error(`Server /start error: ${res.status}`);
    const data = await res.json();
    currentSessionId = data.session_id;
    console.log('[SBDC] Session ID:', currentSessionId);

    // Find or open perchance tab
    let tabs = await chrome.tabs.query({ url: 'https://perchance.org/fluxgen*' });
    if (tabs.length === 0) {
      tabs = await chrome.tabs.create({ url: 'https://perchance.org/fluxgen' }) as any;
      await new Promise(r => setTimeout(r, 5000));
    }
    const tabId = tabs[0].id!;
    injectedTabId = tabId;

    // Wait for the page to fully load, then find iframe and inject
    await injectIntoIframe(tabId);
  } catch (err) {
    console.error('[SBDC] startGeneration error:', err);
  }
}

async function injectIntoIframe(tabId: number) {
  // Execute a script in the main page to find the iframe and inject into it
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      return new Promise((resolve) => {
        function findIframe() {
          const iframe = document.querySelector('iframe');
          if (iframe && iframe.contentWindow) {
            resolve({ frameId: 0 }); // We'll return something; but we need frameId
          } else {
            setTimeout(findIframe, 500);
          }
        }
        findIframe();
      });
    }
  });
  // The above is messy. Instead, use webNavigation to detect frame, or simply inject into all frames.
  // Simpler: inject into all frames and the script will self-detect if it's the correct one.
  // We'll use `chrome.scripting.executeScript` with `allFrames: true` and a script that checks URL.

  const scriptCode = `
    (function() {
      // Run only if this is the right frame (contains fluxgen UI)
      if (window.location.href.includes('perchance.org') && document.querySelector('textarea[data-name="description"]')) {
        console.log('[SBDC] Injected into correct frame');
        chrome.runtime.sendMessage({ type: 'INJECTION_READY' });
        // Store background communication
        window.sbdcBridge = {
          getNextPrompt: () => {
            return new Promise((resolve) => {
              chrome.runtime.sendMessage({ type: 'GET_NEXT_PROMPT' }, resolve);
            });
          },
          submitResult: (promptId, images, take) => {
            chrome.runtime.sendMessage({ type: 'SUBMIT_RESULT', promptId, images, take });
          },
          log: (msg) => chrome.runtime.sendMessage({ type: 'IFRAME_LOG', message: msg })
        };
        // Start polling when background tells us
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
          if (msg.type === 'START_POLLING') {
            startPolling();
            sendResponse({ ok: true });
          }
          return true;
        });
        async function startPolling() {
          while (true) {
            const task = await window.sbdcBridge.getNextPrompt();
            if (!task || task.status === 'DONE') break;
            window.sbdcBridge.log('Processing prompt ' + task.prompt_id);
            // Fill textarea etc.
            const desc = document.querySelector('textarea[data-name="description"]');
            if (desc) {
              desc.value = task.positive;
              desc.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (task.negative) {
              const neg = document.querySelector('textarea[data-name="negative"]');
              if (neg) {
                const container = neg.closest('.input-ctn');
                if (container?.dataset.foldToggleState === 'hidden') container.dataset.foldToggleState = 'shown';
                neg.value = task.negative;
                neg.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
            const shapeSelect = document.querySelector('select[data-name="shape"]');
            if (shapeSelect && task.shape) shapeSelect.value = task.shape;
            document.querySelector('#generateButtonEl')?.click();
            // wait for images...
            await new Promise(r => setTimeout(r, 5000));
            const imgs = document.querySelectorAll('#outputAreaEl img');
            const images = Array.from(imgs).map(img => img.src);
            await window.sbdcBridge.submitResult(task.prompt_id, images, task.take);
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
    })();
  `;

  await chrome.scripting.executeScript({
    target: { tabId: tabId, allFrames: true },
    func: () => {
      const code = arguments[0];
      eval(code);
    },
    args: [scriptCode]
  });
}

async function startPollingInIframe(tabId: number, frameId: number) {
  await chrome.tabs.sendMessage(tabId, { type: 'START_POLLING' }, { frameId: frameId });
}

async function getNextPrompt() {
  if (!currentSessionId) return null;
  try {
    const res = await fetch(`${serverUrl}/next/${currentSessionId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

async function submitResult(promptId: number, images: string[], take: number) {
  if (!currentSessionId) return;
  try {
    await fetch(`${serverUrl}/result/${currentSessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_id: promptId, images, take }),
    });
  } catch (err) {}
}
