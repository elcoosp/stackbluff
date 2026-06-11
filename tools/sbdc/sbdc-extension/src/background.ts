let currentSessionId: string | null = null;
let serverUrl = 'http://localhost:8899';

chrome.storage.local.get(['serverUrl'], (res) => {
  if (res.serverUrl) serverUrl = res.serverUrl;
  console.log('[SBDC Background] Loaded serverUrl:', serverUrl);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[SBDC Background] Received message:', msg);
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
    console.log('[SBDC Background] Server URL set to', serverUrl);
    sendResponse({ ok: true });
  }
  return false;
});

async function ensureContentScript(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    console.log('[SBDC Background] Content script already active');
    return true;
  } catch {
    console.log('[SBDC Background] Content script not active, injecting...');
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content.ts']
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      css: '/* no-op */'
    });
    console.log('[SBDC Background] Injected content script');
    return true;
  }
}

async function startGeneration(deckId: string, takes: number) {
  console.log(`[SBDC Background] Starting generation for deck ${deckId}, takes ${takes}`);
  try {
    const res = await fetch(`${serverUrl}/start/${deckId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takes }),
    });
    if (!res.ok) {
      console.error(`[SBDC Background] Server error: ${res.status} ${res.statusText}`);
      return;
    }
    const data = await res.json();
    currentSessionId = data.session_id;
    console.log('[SBDC Background] Got session ID:', currentSessionId);

    const tabs = await chrome.tabs.query({ url: 'https://perchance.org/fluxgen*' });
    if (tabs.length === 0) {
      console.error('[SBDC Background] No tab with perchance.org/fluxgen found. Please open https://perchance.org/fluxgen');
      // Try to open the tab automatically
      const newTab = await chrome.tabs.create({ url: 'https://perchance.org/fluxgen' });
      await new Promise(r => setTimeout(r, 3000)); // wait for page load
      await ensureContentScript(newTab.id!);
      await chrome.tabs.sendMessage(newTab.id!, { type: 'START_POLLING' });
    } else {
      const tab = tabs[0];
      await ensureContentScript(tab.id!);
      console.log(`[SBDC Background] Sending START_POLLING to tab ${tab.id}`);
      await chrome.tabs.sendMessage(tab.id!, { type: 'START_POLLING' });
    }
  } catch (err) {
    console.error('[SBDC Background] Error in startGeneration:', err);
  }
}

async function getNextPrompt() {
  if (!currentSessionId) {
    console.warn('[SBDC Background] No active session');
    return null;
  }
  try {
    const res = await fetch(`${serverUrl}/next/${currentSessionId}`);
    if (!res.ok) {
      console.error(`[SBDC Background] Next prompt error: ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log('[SBDC Background] Next prompt:', data);
    return data;
  } catch (err) {
    console.error('[SBDC Background] Error fetching next prompt:', err);
    return null;
  }
}

async function submitResult(promptId: number, images: string[], take: number) {
  if (!currentSessionId) return;
  try {
    const res = await fetch(`${serverUrl}/result/${currentSessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_id: promptId, images, take }),
    });
    if (!res.ok) console.error(`[SBDC Background] Submit result error: ${res.status}`);
  } catch (err) {
    console.error('[SBDC Background] Error submitting result:', err);
  }
}
