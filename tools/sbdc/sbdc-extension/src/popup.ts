async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

document.getElementById('start')!.addEventListener('click', async () => {
  const url = (document.getElementById('serverUrl') as HTMLInputElement).value;
  const deckId = (document.getElementById('deckId') as HTMLInputElement).value;
  const takes = parseInt((document.getElementById('takes') as HTMLInputElement).value, 10);
  const status = document.getElementById('status')!;
  status.textContent = 'Starting generation...';
  try {
    await chrome.runtime.sendMessage({ type: 'SET_SERVER_URL', url });
    await chrome.runtime.sendMessage({ type: 'START_GENERATION', deckId, takes });
    status.textContent = 'Generation started. Check console logs.';
  } catch (err: any) {
    status.textContent = `Error: ${err.message}`;
  }
});

document.getElementById('testPing')!.addEventListener('click', async () => {
  const status = document.getElementById('status')!;
  status.textContent = 'Pinging content script...';
  const tab = await getCurrentTab();
  if (!tab.id) { status.textContent = 'No active tab'; return; }
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    status.textContent = `Ping response: ${JSON.stringify(response)}`;
  } catch (err: any) {
    status.textContent = `Ping failed: ${err.message}. Make sure the content script is loaded on this page.`;
  }
});

document.getElementById('manualFill')!.addEventListener('click', async () => {
  const status = document.getElementById('status')!;
  status.textContent = 'Sending manual fill...';
  const tab = await getCurrentTab();
  if (!tab.id) { status.textContent = 'No active tab'; return; }
  const testPrompt = {
    positive: "a majestic fantasy landscape, epic mountains, sunset, pure white background",
    negative: "blurry, text, watermark",
    shape: "2:3"
  };
  try {
    const response = await chrome.runtime.sendMessage({ type: 'MANUAL_FILL', prompt: testPrompt });
    status.textContent = 'Manual fill sent. Check if the textarea got filled.';
  } catch (err: any) {
    status.textContent = `Manual fill error: ${err.message}`;
  }
});
