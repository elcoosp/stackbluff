let currentSessionId: string | null = null;
let serverUrl = 'http://localhost:8899';

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
  }
  return false;
});

async function ensureContentScriptReady(tabId: number, maxRetries = 5): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      if (response && response.status === 'alive') {
        console.log(`[SBDC] Content script ready (attempt ${i+1})`);
        return true;
      }
    } catch (err) {
      console.log(`[SBDC] Ping attempt ${i+1} failed`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

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

    // Find perchance tab
    let tabs = await chrome.tabs.query({ url: 'https://perchance.org/fluxgen*' });
    if (tabs.length === 0) {
      console.error('[SBDC] No perchance tab, opening new one');
      tabs = await chrome.tabs.create({ url: 'https://perchance.org/fluxgen' }) as any;
      await new Promise(r => setTimeout(r, 3000));
    }
    const tabId = tabs[0].id!;
    console.log(`[SBDC] Using tab ${tabId}`);

    const ready = await ensureContentScriptReady(tabId);
    if (!ready) {
      console.error('[SBDC] Content script not responding. Please refresh the perchance page and try again.');
      return;
    }

    await chrome.tabs.sendMessage(tabId, { type: 'START_POLLING' });
    console.log('[SBDC] START_POLLING sent');
  } catch (err) {
    console.error('[SBDC] startGeneration error:', err);
  }
}

async function getNextPrompt() {
  if (!currentSessionId) return null;
  try {
    const res = await fetch(`${serverUrl}/next/${currentSessionId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[SBDC] getNextPrompt error:', err);
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
  } catch (err) {
    console.error('[SBDC] submitResult error:', err);
  }
}
