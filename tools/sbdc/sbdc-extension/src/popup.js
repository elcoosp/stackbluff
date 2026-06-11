const serverUrlInput = document.getElementById('serverUrl');
const deckIdInput = document.getElementById('deckId');
const takesInput = document.getElementById('takes');
const statusDiv = document.getElementById('status');
const startBtn = document.getElementById('start');

chrome.storage.local.get(['serverUrl', 'deckId', 'takes'], (res) => {
  if (res.serverUrl) serverUrlInput.value = res.serverUrl;
  if (res.deckId) deckIdInput.value = res.deckId;
  if (res.takes) takesInput.value = res.takes;
});

startBtn.onclick = async () => {
  const url = serverUrlInput.value.replace(/\/$/, '');
  const deckId = deckIdInput.value;
  const takes = parseInt(takesInput.value, 10) || 4;

  chrome.storage.local.set({ serverUrl: url, deckId, takes });
  chrome.runtime.sendMessage({ type: 'SET_SERVER_URL', url });
  statusDiv.textContent = 'Starting...';
  try {
    await chrome.runtime.sendMessage({ type: 'START_GENERATION', deckId, takes });
    statusDiv.textContent = 'Generation started. Check background console.';
  } catch (err) {
    statusDiv.textContent = 'Error: ' + err.message;
  }
};
