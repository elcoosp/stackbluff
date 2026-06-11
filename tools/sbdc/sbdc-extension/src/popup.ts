const serverUrl = document.getElementById('serverUrl') as HTMLInputElement;
const deckId = document.getElementById('deckId') as HTMLInputElement;
const takes = document.getElementById('takes') as HTMLInputElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const status = document.getElementById('status')!;

chrome.storage.local.get(['serverUrl', 'deckId', 'takes'], (res: any) => {
  if (res.serverUrl) serverUrl.value = res.serverUrl;
  if (res.deckId) deckId.value = res.deckId;
  if (res.takes) takes.value = res.takes;
});

startBtn.addEventListener('click', async () => {
  const url = serverUrl.value.replace(/\/$/, '');
  const deck = deckId.value || 'persist';
  const numTakes = parseInt(takes.value, 10) || 4;

  chrome.storage.local.set({ serverUrl: url, deckId: deck, takes: takes.value });
  chrome.runtime.sendMessage({ type: 'SET_SERVER_URL', url });

  status.textContent = 'Connecting...';

  try {
    const resp = await fetch(url + '/start/' + deck, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takes: numTakes }),
    });

    if (resp.ok) {
      const data = await resp.json();
      status.textContent = '✅ Started! ' + (data.total || 0) + ' prompts loaded.\nOpen perchance.org/fluxgen';
    } else {
      status.textContent = '❌ HTTP ' + resp.status + '\n' + await resp.text();
    }
  } catch (e: any) {
    status.textContent = '❌ FETCH FAILED:\n' + e.message + '\n\nIs server running?\ncargo run --bin sbdc\n-- serve --deck ' + deck;
  }
});
