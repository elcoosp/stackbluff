let currentSessionId: string | null = null;
let serverUrl = 'http://localhost:8899';

console.log('[BG] Script started');

chrome.storage.local.get(['serverUrl'], (res) => {
  if (res.serverUrl) serverUrl = res.serverUrl;
  console.log('[BG] Loaded serverUrl:', serverUrl);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[BG] Received message:', JSON.stringify(msg), 'from', sender.tab?.id, sender.frameId);
  if (msg.type === 'START_GENERATION') {
    startGeneration(msg.deckId, msg.takes).then(() => sendResponse({ ok: true })).catch(err => sendResponse({ error: err.message }));
    return true;
  } else if (msg.type === 'GET_NEXT_PROMPT') {
    getNextPrompt().then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  } else if (msg.type === 'SUBMIT_RESULT') {
    submitResult(msg.promptId, msg.images, msg.take).then(() => sendResponse({ ok: true })).catch(err => sendResponse({ error: err.message }));
    return true;
  } else if (msg.type === 'SET_SERVER_URL') {
    serverUrl = msg.url;
    chrome.storage.local.set({ serverUrl });
    console.log('[BG] Server URL set to', serverUrl);
    sendResponse({ ok: true });
    return true;
  } else if (msg.type === 'TEST_PING') {
    console.log('[BG] Test ping received, sending pong');
    sendResponse({ status: 'pong' });
    return true;
  } else if (msg.type === 'MANUAL_FILL') {
    console.log('[BG] Manual fill request for frame', sender.frameId);
    // Send to content script in same frame
    chrome.tabs.sendMessage(sender.tab.id, { type: 'MANUAL_FILL', prompt: msg.prompt }, { frameId: sender.frameId }).then(() => {
      sendResponse({ ok: true });
    }).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  console.warn('[BG] Unhandled message type:', msg.type);
  return false;
});

async function startGeneration(deckId: string, takes: number) {
  console.log(`[BG] startGeneration called with deck=${deckId} takes=${takes}`);
  try {
    const res = await fetch(`${serverUrl}/start/${deckId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takes }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    currentSessionId = data.session_id;
    console.log('[BG] Session created:', currentSessionId);

    const tabs = await chrome.tabs.query({ url: 'https://perchance.org/fluxgen*' });
    if (tabs.length === 0) {
      console.error('[BG] No perchance tab found. Open https://perchance.org/fluxgen manually.');
      return;
    }
    const tabId = tabs[0].id;
    console.log(`[BG] Sending START_POLLING to tab ${tabId}`);
    await chrome.tabs.sendMessage(tabId, { type: 'START_POLLING' });
    console.log('[BG] START_POLLING sent successfully');
  } catch (err) {
    console.error('[BG] startGeneration error:', err);
  }
}

async function getNextPrompt() {
  if (!currentSessionId) {
    console.warn('[BG] getNextPrompt: no session');
    return null;
  }
  console.log('[BG] Fetching next prompt for session', currentSessionId);
  try {
    const res = await fetch(`${serverUrl}/next/${currentSessionId}`);
    if (!res.ok) {
      console.error(`[BG] fetch next prompt failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log('[BG] Next prompt:', data);
    return data;
  } catch (err) {
    console.error('[BG] getNextPrompt error:', err);
    return null;
  }
}

async function submitResult(promptId: number, images: string[], take: number) {
  if (!currentSessionId) return;
  console.log(`[BG] Submitting result for prompt ${promptId}, take ${take}, ${images.length} images`);
  try {
    const res = await fetch(`${serverUrl}/result/${currentSessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_id: promptId, images, take }),
    });
    if (!res.ok) console.error(`[BG] Submit result failed: ${res.status}`);
    else console.log('[BG] Submit result OK');
  } catch (err) {
    console.error('[BG] submitResult error:', err);
  }
}
