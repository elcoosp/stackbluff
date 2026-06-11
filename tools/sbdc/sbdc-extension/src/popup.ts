const serverUrlEl = document.getElementById("serverUrl") as HTMLInputElement;
const deckIdEl = document.getElementById("deckId") as HTMLInputElement;
const takesEl = document.getElementById("takes") as HTMLInputElement;
const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const statusBtn = document.getElementById("statusBtn") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;

interface StorageResult {
  serverUrl?: string;
  deckId?: string;
  takes?: string;
}

interface StartResponse {
  deck_id: string;
  takes_per_prompt: number;
  prompts_ready: number;
}

interface StatusResponse {
  deck_id: string;
  status: string;
  total_prompts: number;
  ready_to_generate: number;
  generating: number;
  takes_ready: number;
  cleaned: number;
  takes_per_prompt: number;
}

chrome.storage.local.get(["serverUrl", "deckId", "takes"], (res: StorageResult) => {
  if (res.serverUrl) serverUrlEl.value = res.serverUrl;
  if (res.deckId) deckIdEl.value = res.deckId;
  if (res.takes) takesEl.value = res.takes;
});

startBtn.addEventListener("click", async () => {
  const url = serverUrlEl.value.replace(/\/$/, "");
  const deck = deckIdEl.value.trim();
  const numTakes = parseInt(takesEl.value, 10) || 4;

  if (!deck) {
    statusEl.textContent = "Please enter a Deck ID";
    return;
  }

  chrome.storage.local.set({ serverUrl: url, deckId: deck, takes: takesEl.value });
  chrome.runtime.sendMessage({ type: "SET_SERVER_URL", url });

  statusEl.textContent = "Starting generation...";

  try {
    const resp = await fetch(
      `${url}/api/decks/${encodeURIComponent(deck)}/start`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ takes_per_prompt: numTakes }),
      },
    );

    if (resp.ok) {
      const data: StartResponse = await resp.json();
      statusEl.textContent =
        `Started! ${data.prompts_ready || 0} prompts ready.\n` +
        `Takes per prompt: ${data.takes_per_prompt || numTakes}\n` +
        "Open perchance.org/fluxgen";
    } else {
      const text = await resp.text();
      statusEl.textContent = `HTTP ${resp.status}\n${text}`;
    }
  } catch (e: Error) {
    statusEl.textContent =
      `FETCH FAILED:\n${e.message}\n\nIs server running?\n` +
      "cargo run --bin sbdc -- serve --port 8899";
  }
});

statusBtn.addEventListener("click", async () => {
  const url = serverUrlEl.value.replace(/\/$/, "");
  const deck = deckIdEl.value.trim();

  if (!deck) {
    statusEl.textContent = "Please enter a Deck ID";
    return;
  }

  statusEl.textContent = "Checking...";

  try {
    const resp = await fetch(`${url}/api/decks/${encodeURIComponent(deck)}/status`);
    if (resp.ok) {
      const data: StatusResponse = await resp.json();
      statusEl.textContent =
        `Deck: ${data.deck_id}\n` +
        `Status: ${data.status}\n` +
        `Total: ${data.total_prompts}\n` +
        `Ready: ${data.ready_to_generate}\n` +
        `Generating: ${data.generating}\n` +
        `Takes ready: ${data.takes_ready}\n` +
        `Cleaned: ${data.cleaned}`;
    } else {
      statusEl.textContent = `HTTP ${resp.status}`;
    }
  } catch (e: Error) {
    statusEl.textContent = `FETCH FAILED:\n${e.message}`;
  }
});
