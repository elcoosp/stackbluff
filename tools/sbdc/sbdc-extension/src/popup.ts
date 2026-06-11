document.getElementById('start')!.onclick = async () => {
  const url = (document.getElementById('serverUrl') as HTMLInputElement).value;
  const deckId = (document.getElementById('deckId') as HTMLInputElement).value;
  const takes = parseInt((document.getElementById('takes') as HTMLInputElement).value, 10);
  const status = document.getElementById('status')!;
  status.textContent = 'Starting...';
  try {
    await chrome.runtime.sendMessage({ type: 'SET_SERVER_URL', url });
    await chrome.runtime.sendMessage({ type: 'START_GENERATION', deckId, takes });
    status.textContent = 'Started. Check console (F12) on perchance page.';
  } catch (err) {
    status.textContent = 'Error: ' + err;
  }
};
