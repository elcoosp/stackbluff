document.getElementById('start')!.addEventListener('click', async () => {
  const url = (document.getElementById('serverUrl') as HTMLInputElement).value;
  const deckId = (document.getElementById('deckId') as HTMLInputElement).value;
  const takes = parseInt((document.getElementById('takes') as HTMLInputElement).value, 10);

  const statusDiv = document.getElementById('status')!;
  statusDiv.textContent = 'Starting generation...';
  statusDiv.style.backgroundColor = '#fff3cd';
  statusDiv.style.color = '#856404';

  try {
    await chrome.runtime.sendMessage({ type: 'SET_SERVER_URL', url });
    await chrome.runtime.sendMessage({ type: 'START_GENERATION', deckId, takes });
    statusDiv.textContent = 'Generation started. Check console (F12) on perchance page for logs.';
    statusDiv.style.backgroundColor = '#d4edda';
    statusDiv.style.color = '#155724';
  } catch (err: any) {
    statusDiv.textContent = `Error: ${err.message || err}`;
    statusDiv.style.backgroundColor = '#f8d7da';
    statusDiv.style.color = '#721c24';
  }
});

document.getElementById('refreshPage')!.addEventListener('click', async () => {
  const statusDiv = document.getElementById('status')!;
  statusDiv.textContent = 'Refreshing perchance page...';
  statusDiv.style.backgroundColor = '#fff3cd';
  try {
    const tabs = await chrome.tabs.query({ url: 'https://perchance.org/fluxgen*' });
    if (tabs.length === 0) {
      statusDiv.textContent = 'No perchance.org/fluxgen tab found. Opening new one...';
      await chrome.tabs.create({ url: 'https://perchance.org/fluxgen' });
    } else {
      await chrome.tabs.reload(tabs[0].id!);
    }
    statusDiv.textContent = 'Page refreshed. You can now try Start Generation.';
    statusDiv.style.backgroundColor = '#d4edda';
  } catch (err: any) {
    statusDiv.textContent = `Refresh failed: ${err.message}`;
    statusDiv.style.backgroundColor = '#f8d7da';
  }
});
