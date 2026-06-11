document.getElementById('start')!.addEventListener('click', async () => {
  const url = (document.getElementById('serverUrl') as HTMLInputElement).value;
  const deckId = (document.getElementById('deckId') as HTMLInputElement).value;
  const takes = parseInt((document.getElementById('takes') as HTMLInputElement).value, 10);

  const statusDiv = document.getElementById('status') || (() => {
    const div = document.createElement('div');
    div.id = 'status';
    div.style.marginTop = '10px';
    div.style.padding = '5px';
    div.style.borderRadius = '4px';
    document.body.appendChild(div);
    return div;
  })();
  statusDiv.textContent = 'Starting generation...';
  statusDiv.style.backgroundColor = '#fff3cd';
  statusDiv.style.color = '#856404';

  try {
    await chrome.runtime.sendMessage({ type: 'SET_SERVER_URL', url });
    await chrome.runtime.sendMessage({ type: 'START_GENERATION', deckId, takes });
    statusDiv.textContent = 'Generation started. Check console (F12) for logs.';
    statusDiv.style.backgroundColor = '#d4edda';
    statusDiv.style.color = '#155724';
  } catch (err) {
    statusDiv.textContent = `Error: ${err}`;
    statusDiv.style.backgroundColor = '#f8d7da';
    statusDiv.style.color = '#721c24';
  }
});
