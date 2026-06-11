let serverUrl = "http://localhost:8899";

chrome.storage.local.get(["serverUrl"], (res: any) => {
  if (res.serverUrl) serverUrl = res.serverUrl;
  console.log("[BG] serverUrl:", serverUrl);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[BG] msg:", msg.type);

  if (msg.type === "FETCH") {
    console.log("[BG] fetching:", msg.url);
    const opts: RequestInit = { method: msg.method || "GET" };
    if (msg.body) {
      opts.body = msg.body;
      opts.headers = { "Content-Type": "application/json" };
    }
    fetch(msg.url, opts)
      .then(r => r.text())
      .then(text => {
        console.log("[BG] response:", text.substring(0, 100));
        try { sendResponse({ ok: true, data: JSON.parse(text) }); }
        catch { sendResponse({ ok: true, data: text }); }
      })
      .catch(e => {
        console.error("[BG] fetch error:", e);
        sendResponse({ ok: false, error: String(e) });
      });
    return true;
  }

  if (msg.type === 'SET_SERVER_URL') {
    serverUrl = msg.url;
    chrome.storage.local.set({ serverUrl });
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'GET_SERVER_URL') {
    sendResponse({ ok: true, url: serverUrl });
    return false;
  }

  return false;
});
