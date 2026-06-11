let currentSessionId: string | null = null;
let serverUrl = "http://localhost:8899";

chrome.storage.local.get(["serverUrl"], (res) => {
  if (res.serverUrl) serverUrl = res.serverUrl;
  console.log("[BG] serverUrl =", serverUrl);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[BG] Received message:", msg);
  if (msg.type === "START_GENERATION") {
    startGeneration(msg.deckId, msg.takes).then(() => sendResponse({ ok: true }));
    return true;
  } else if (msg.type === "GET_NEXT_PROMPT") {
    getNextPrompt().then(sendResponse);
    return true;
  } else if (msg.type === "SUBMIT_RESULT") {
    submitResult(msg.promptId, msg.images, msg.take).then(sendResponse);
    return true;
  } else if (msg.type === "SET_SERVER_URL") {
    serverUrl = msg.url;
    chrome.storage.local.set({ serverUrl });
    sendResponse({ ok: true });
  }
  return false;
});

async function startGeneration(deckId: string, takes: number) {
  console.log(`[BG] startGeneration deck=${deckId} takes=${takes}`);
  try {
    const res = await fetch(`${serverUrl}/start/${deckId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ takes }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    currentSessionId = data.session_id;
    console.log("[BG] Session started:", currentSessionId);

    const tabs = await chrome.tabs.query({ url: "https://perchance.org/fluxgen*" });
    if (tabs.length === 0) {
      console.error("[BG] No perchance tab found. Open https://perchance.org/fluxgen");
      return;
    }
    const tabId = tabs[0].id!;
    console.log(`[BG] Sending START_POLLING to tab ${tabId}`);
    await chrome.tabs.sendMessage(tabId, { type: "START_POLLING" });
    console.log("[BG] START_POLLING sent");
  } catch (err) {
    console.error("[BG] startGeneration error:", err);
  }
}

async function getNextPrompt() {
  if (!currentSessionId) {
    console.warn("[BG] No active session");
    return null;
  }
  try {
    const res = await fetch(`${serverUrl}/next/${currentSessionId}`);
    if (!res.ok) {
      console.warn(`[BG] /next returned ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log("[BG] Next prompt:", data);
    return data;
  } catch (err) {
    console.error("[BG] getNextPrompt error:", err);
    return null;
  }
}

async function submitResult(promptId: number, images: string[], take: number) {
  if (!currentSessionId) return;
  try {
    const res = await fetch(`${serverUrl}/result/${currentSessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt_id: promptId, images, take }),
    });
    if (!res.ok) console.error(`[BG] submitResult error: ${res.status}`);
  } catch (err) {
    console.error("[BG] submitResult error:", err);
  }
}
