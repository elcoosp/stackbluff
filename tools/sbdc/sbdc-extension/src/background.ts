const defaultServerUrl = "http://localhost:8899";
let serverUrl = defaultServerUrl;

interface FetchMessage {
  type: "FETCH";
  url: string;
  method?: string;
  body?: string;
}

interface SetServerUrlMessage {
  type: "SET_SERVER_URL";
  url: string;
}

interface GetServerUrlMessage {
  type: "GET_SERVER_URL";
}

interface StorageResult {
  serverUrl?: string;
  deckId?: string;
  takes?: string;
}

type ExtensionMessage = FetchMessage | SetServerUrlMessage | GetServerUrlMessage;

chrome.storage.local.get(["serverUrl"], (res: StorageResult) => {
  if (res.serverUrl) {
    serverUrl = res.serverUrl;
  }
  console.log("[BG] serverUrl:", serverUrl);
});

chrome.runtime.onMessage.addListener(
  (msg: ExtensionMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    if (msg.type === "FETCH") {
      const opts: RequestInit = { method: msg.method || "GET" };
      if (msg.body) {
        opts.body = msg.body;
        opts.headers = { "Content-Type": "application/json" };
      }
      fetch(msg.url, opts)
        .then((r) => r.text())
        .then((text) => {
          try {
            sendResponse({ ok: true, data: JSON.parse(text) });
          } catch {
            sendResponse({ ok: true, data: text });
          }
        })
        .catch((e: Error) => {
          console.error("[BG] fetch error:", e);
          sendResponse({ ok: false, error: String(e) });
        });
      return true;
    }

    if (msg.type === "SET_SERVER_URL") {
      serverUrl = msg.url;
      chrome.storage.local.set({ serverUrl });
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === "GET_SERVER_URL") {
      sendResponse({ ok: true, url: serverUrl });
      return false;
    }

    return false;
  },
);
