let currentSessionId: string | null = null;
let serverUrl = 'http://localhost:8899';

chrome.storage.local.get(['serverUrl'], (res) => {
  if (res.serverUrl) serverUrl = res.serverUrl;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_GENERATION') {
    startGeneration(msg.deckId, msg.takes);
  } else if (msg.type === 'GET_NEXT_PROMPT') {
    getNextPrompt().then(sendResponse);
    return true;
  } else if (msg.type === 'SUBMIT_RESULT') {
    submitResult(msg.promptId, msg.images, msg.take).then(sendResponse);
    return true;
  } else if (msg.type === 'SET_SERVER_URL') {
    serverUrl = msg.url;
    chrome.storage.local.set({ serverUrl });
  }
});

async function startGeneration(deckId: string, takes: number) {
  const res = await fetch(`${serverUrl}/start/${deckId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ takes }),
  });
  const { session_id } = await res.json();
  currentSessionId = session_id;

  chrome.tabs.query({ url: 'https://perchance.org/fluxgen*' }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id!, { type: 'START_POLLING' });
    }
  });
}

async function getNextPrompt() {
  if (!currentSessionId) return null;
  const res = await fetch(`${serverUrl}/next/${currentSessionId}`);
  return res.json();
}

async function submitResult(promptId: number, images: string[], take: number) {
  if (!currentSessionId) return;
  await fetch(`${serverUrl}/result/${currentSessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt_id: promptId, images, take }),
  });
}
