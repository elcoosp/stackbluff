document.getElementById('start')!.addEventListener('click', () => {
  const url = (document.getElementById('serverUrl') as HTMLInputElement).value;
  const deckId = (document.getElementById('deckId') as HTMLInputElement).value;
  const takes = parseInt((document.getElementById('takes') as HTMLInputElement).value, 10);
  chrome.runtime.sendMessage({ type: 'SET_SERVER_URL', url });
  chrome.runtime.sendMessage({ type: 'START_GENERATION', deckId, takes });
});
