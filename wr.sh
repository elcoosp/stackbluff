#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

BASE="tools/sbdc"

echo "Verifying server.rs was written correctly"
head -5 "$BASE/sbdc-service/src/server.rs" 2>&1

echo "Patching $BASE/sbdc-cli/src/main.rs: remove Generate command, fix Serve"
OLD_TMP=$(mktemp) || { echo "ERROR: cannot create temp file"; exit 1; }
NEW_TMP=$(mktemp)
cat > "$OLD_TMP" << 'OLD_CLI_K8pQ2'
#[derive(Subcommand)]
enum Commands {
    Init,
    Scaffold {
        #[arg(short, long)]
        deck_id: String,
        #[arg(short, long, default_value = "default_season")]
        season_id: String,
    },
    IngestJson {
        #[arg(short, long)]
        deck_id: String,
        #[arg(short, long)]
        file: PathBuf,
    },
    BuildPrompts {
        #[arg(short, long)]
        deck_id: String,
    },
    Generate {
        #[arg(short, long)]
        deck_id: String,
        #[arg(long, default_value_t = 4)]
        takes: u32,
        #[arg(long, default_value = "5-15")]
        delay: String,
    },
    Clean {
        #[arg(short, long)]
        deck_id: String,
    },
    Serve {
        #[arg(short, long)]
        deck_id: String,
        #[arg(long, default_value_t = 8899)]
        port: u16,
        #[arg(long, default_value_t = 4)]
        takes: u32,
    },
}
OLD_CLI_K8pQ2
cat > "$NEW_TMP" << 'NEW_CLI_M3vR7'
#[derive(Subcommand)]
enum Commands {
    Init,
    Scaffold {
        #[arg(short, long)]
        deck_id: String,
        #[arg(short, long, default_value = "default_season")]
        season_id: String,
    },
    IngestJson {
        #[arg(short, long)]
        deck_id: String,
        #[arg(short, long)]
        file: PathBuf,
    },
    BuildPrompts {
        #[arg(short, long)]
        deck_id: String,
    },
    Clean {
        #[arg(short, long)]
        deck_id: String,
    },
    Serve {
        #[arg(long, default_value_t = 8899)]
        port: u16,
    },
}
NEW_CLI_M3vR7
if python3 - "$OLD_TMP" "$NEW_TMP" "$BASE/sbdc-cli/src/main.rs" << 'PYEOF_CLI1'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF_CLI1
then
  echo "Python patch succeeded for CLI Commands enum"
  rm "$OLD_TMP" "$NEW_TMP"
else
  echo "ERROR: Python patch failed for CLI Commands enum"
  rm -f "$OLD_TMP" "$NEW_TMP"
fi

echo "Patching $BASE/sbdc-cli/src/main.rs: remove Generate and fix Serve match arms"
OLD_TMP=$(mktemp) || { echo "ERROR: cannot create temp file"; exit 1; }
NEW_TMP=$(mktemp)
cat > "$OLD_TMP" << 'OLD_MATCH_J5wE9'
    let result = match cli.command {
        Commands::Init => sbdc_service::init::run_init(&db, &cli.project_dir).await,
        Commands::Scaffold { deck_id, season_id } => sbdc_service::scaffold::run_scaffold(&db, &cli.project_dir, &deck_id, &season_id).await,
        Commands::IngestJson { deck_id, file } => sbdc_service::ingest::run_ingest_json(&db, &deck_id, &file).await,
        Commands::BuildPrompts { deck_id } => sbdc_service::build_prompts::run_build_prompts(&db, &deck_id).await,
        Commands::Generate { deck_id, takes, delay } => sbdc_service::generate::run_generate(&db, &cli.project_dir, &deck_id, takes, &delay).await,
        Commands::Serve { deck_id: _, port, takes: _ } => sbdc_service::server::run_server(db, cli.project_dir, port).await.map_err(|e| SbdcError::DbOperation(e.to_string())),
        Commands::Clean { deck_id } => sbdc_service::clean::run_clean(&db, &cli.project_dir, &deck_id).await,
    };
OLD_MATCH_J5wE9
cat > "$NEW_TMP" << 'NEW_MATCH_N2tA4'
    let result = match cli.command {
        Commands::Init => sbdc_service::init::run_init(&db, &cli.project_dir).await,
        Commands::Scaffold { deck_id, season_id } => sbdc_service::scaffold::run_scaffold(&db, &cli.project_dir, &deck_id, &season_id).await,
        Commands::IngestJson { deck_id, file } => sbdc_service::ingest::run_ingest_json(&db, &deck_id, &file).await,
        Commands::BuildPrompts { deck_id } => sbdc_service::build_prompts::run_build_prompts(&db, &deck_id).await,
        Commands::Serve { port } => sbdc_service::server::run_server(db, cli.project_dir, port).await.map_err(|e| SbdcError::DbOperation(e.to_string())),
        Commands::Clean { deck_id } => sbdc_service::clean::run_clean(&db, &cli.project_dir, &deck_id).await,
    };
NEW_MATCH_N2tA4
if python3 - "$OLD_TMP" "$NEW_TMP" "$BASE/sbdc-cli/src/main.rs" << 'PYEOF_CLI2'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF_CLI2
then
  echo "Python patch succeeded for CLI match arms"
  rm "$OLD_TMP" "$NEW_TMP"
else
  echo "ERROR: Python patch failed for CLI match arms"
  rm -f "$OLD_TMP" "$NEW_TMP"
fi

echo "Writing $BASE/sbdc-extension/src/background.ts (updated for new API)"
cat > "$BASE/sbdc-extension/src/background.ts" << 'BGT_V2_R7kM1'
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
BGT_V2_R7kM1

echo "Writing $BASE/sbdc-extension/src/content.ts (updated for new API paths)"
cat > "$BASE/sbdc-extension/src/content.ts" << 'CTS_V2_P4nL8'
(function () {
  const FRAME_ID = window.location.hostname.substring(0, 40);

  function log(m: string) {
    const line = `[SBDC][${FRAME_ID}] ${m}`;
    console.log('%c' + line, 'color:#0ff;font-weight:bold;font-size:14px;');
    try {
      const ind = document.getElementById('sbdc-indicator');
      if (ind) { ind.textContent = line; }
    } catch { }
  }

  function setIndicator(color: string, text: string) {
    try {
      let ind = document.getElementById('sbdc-indicator');
      if (!ind) {
        ind = document.createElement('div');
        ind.id = 'sbdc-indicator';
        ind.style.cssText = 'position:fixed;top:0;left:0;z-index:999999;color:white;font:bold 14px monospace;padding:8px 12px;pointer-events:none;max-width:100%;white-space:nowrap;';
        (document.body || document.documentElement).appendChild(ind);
      }
      ind.style.background = color;
      ind.textContent = text;
    } catch { }
  }

  setIndicator('red', '[SBDC] Script loaded in ' + FRAME_ID);
  log('Content script loaded. URL: ' + window.location.href);

  async function getServerUrl(): Promise<string> {
    const resp: any = await chrome.runtime.sendMessage({ type: 'GET_SERVER_URL' });
    return resp?.url || 'http://localhost:8899';
  }

  async function getDeckId(): Promise<string> {
    const resp: any = await new Promise(resolve => {
      chrome.storage.local.get(['deckId'], (res: any) => resolve(res));
    });
    return resp?.deckId || '';
  }

  async function waitForUI(): Promise<boolean> {
    for (let i = 0; i < 120; i++) {
      if (document.querySelector('textarea[data-name="description"]') && document.querySelector('#generateButtonEl')) {
        log('UI found after ' + i + 's');
        return true;
      }
      if (i % 5 === 0) {
        log('Waiting for UI... (' + i + 's)');
        setIndicator('red', '[SBDC] Waiting for UI... (' + i + 's)');
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    log('No UI found. Exiting.');
    setIndicator('orange', '[SBDC] No generator UI');
    return false;
  }

  async function serverFetch(urlPath: string, method?: string, body?: string): Promise<any> {
    const base = await getServerUrl();
    const url = base + urlPath;
    log('FETCH ' + (method || 'GET') + ' ' + url);
    try {
      const resp: any = await chrome.runtime.sendMessage({
        type: 'FETCH',
        url,
        method: method || 'GET',
        body: body || null
      });
      log('FETCH response: ' + JSON.stringify(resp).substring(0, 200));
      if (!resp) throw new Error('No response from background');
      if (!resp.ok) throw new Error(resp.error || 'Fetch failed');
      return resp.data;
    } catch (e: any) {
      log('FETCH ERROR: ' + e.message);
      throw e;
    }
  }

  function fillTextarea(selector: string, value: string): boolean {
    const el = document.querySelector(selector) as HTMLTextAreaElement | null;
    if (!el) { log('Not found: ' + selector); return false; }
    el.focus();
    el.setSelectionRange(0, el.value.length);
    const ok = document.execCommand('insertText', false, value);
    if (!ok) {
      log('execCommand failed, using setter');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  (async () => {
    if (!await waitForUI()) return;

    setIndicator('green', '[SBDC] UI ready! Checking server...');

    const deckId = await getDeckId();
    if (!deckId) {
      log('No deck ID set. Use popup to configure.');
      setIndicator('orange', '[SBDC] No deck ID — use popup');
      return;
    }
    log('Using deck: ' + deckId);

    let ready = false;
    while (!ready) {
      try {
        const status = await serverFetch('/api/decks/' + deckId + '/status');
        log('Status: ' + JSON.stringify(status));
        if (status && status.ready_to_generate > 0) {
          ready = true;
          log(status.ready_to_generate + ' prompts ready!');
          setIndicator('green', '[SBDC] ' + status.ready_to_generate + ' prompts! Starting...');
        } else {
          log('Server OK but no prompts ready. Use popup to start.');
          setIndicator('orange', '[SBDC] No prompts — click Start');
        }
      } catch (e: any) {
        log('Server not reachable: ' + e.message);
        setIndicator('darkred', '[SBDC] No server');
      }
      if (!ready) await new Promise(r => setTimeout(r, 3000));
    }

    while (true) {
      let item: any;
      try {
        item = await serverFetch('/api/decks/' + deckId + '/prompts/next');
      } catch (e: any) {
        log('Server lost: ' + e.message);
        setIndicator('darkred', '[SBDC] Server lost');
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      if (item && item.status === 'no_more_prompts') {
        setIndicator('orange', '[SBDC] No more prompts — start from popup');
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      if (!item || !item.prompt_id) {
        log('All prompts complete!');
        setIndicator('blue', '[SBDC] ALL DONE!');
        break;
      }

      log('Processing prompt_id=' + item.prompt_id + ' card=' + item.target_card + ' layer=' + item.target_layer);
      setIndicator('green', '[SBDC] Prompt ' + item.target_card + '/' + item.target_layer);

      const numImages = 4;
      const ns = document.querySelector('select[data-name="numImages"]') as HTMLSelectElement | null;
      if (ns) { ns.value = String(numImages); ns.dispatchEvent(new Event('change', { bubbles: true })); }

      fillTextarea('textarea[data-name="description"]', item.positive);
      const v = document.querySelector('textarea[data-name="description"]') as HTMLTextAreaElement | null;
      log('Positive: "' + (v ? v.value.substring(0, 80) : 'NULL') + '..."');

      if (item.negative) {
        const neg = document.querySelector('textarea[data-name="negative"]') as HTMLTextAreaElement | null;
        if (neg) {
          const ctn = neg.closest('.input-ctn') as HTMLElement | null;
          if (ctn && ctn.dataset.foldToggleState === 'hidden') {
            ctn.dataset.foldToggleState = 'shown';
            await new Promise(r => setTimeout(r, 300));
          }
          fillTextarea('textarea[data-name="negative"]', item.negative);
          log('Negative set.');
        }
      }

      const before = document.querySelectorAll('#outputAreaEl img').length;
      log('Generating ' + numImages + ' (before: ' + before + ')...');
      setIndicator('darkgreen', '[SBDC] Generating ' + item.target_card + '...');
      document.querySelector('#generateButtonEl')!.click();

      await new Promise<void>(resolve => {
        const iv = setInterval(() => {
          const imgs = document.querySelectorAll('#outputAreaEl img');
          if (imgs.length >= before + numImages) {
            let ok = true;
            for (let i = before; i < before + numImages; i++) {
              if (!(imgs[i] as HTMLImageElement).complete || (imgs[i] as HTMLImageElement).naturalHeight === 0) { ok = false; break; }
            }
            if (ok) { clearInterval(iv); resolve(); }
          }
        }, 1000);
      });
      log('Images loaded!');

      const imgs = document.querySelectorAll('#outputAreaEl img');
      const images: Array<{ index: number; data: string }> = [];
      for (let i = before; i < before + numImages; i++) {
        const src = (imgs[i] as HTMLImageElement).src;
        if (src.startsWith('data:')) {
          images.push({ index: i - before, data: src });
        } else {
          try {
            const resp = await fetch(src);
            const blob = await resp.blob();
            const data = await new Promise<string>(res => {
              const rd = new FileReader();
              rd.onload = () => res(rd.result as string);
              rd.readAsDataURL(blob);
            });
            images.push({ index: i - before, data });
          } catch { log('Image fetch failed'); }
        }
      }

      try {
        const resultUrl = '/api/decks/' + deckId + '/prompts/' + item.prompt_id + '/takes';
        await serverFetch(resultUrl, 'POST', JSON.stringify({ images }));
        log('Takes submitted for prompt ' + item.prompt_id);
      } catch (e: any) { log('Submit failed: ' + e.message); }

      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
    }
  })();
})();
CTS_V2_P4nL8

echo "Writing $BASE/sbdc-extension/src/popup.html (improved UI with status)"
cat > "$BASE/sbdc-extension/src/popup.html" << 'POPHTM_V3_W6yT2'
<!DOCTYPE html>
<html>
<head>
  <title>SBDC</title>
  <style>
    body { width: 340px; padding: 12px; font-family: system-ui, sans-serif; font-size: 13px; }
    label { display: block; margin-top: 8px; font-weight: 600; }
    input { width: 100%; box-sizing: border-box; padding: 4px 6px; margin-top: 2px; }
    button { margin-top: 10px; width: 100%; padding: 8px; cursor: pointer; font-weight: 600; }
    #status { margin-top: 10px; font-size: 12px; white-space: pre-wrap; font-family: monospace; }
    .btn-row { display: flex; gap: 6px; }
    .btn-row button { flex: 1; }
  </style>
</head>
<body>
  <h3 style="margin:0 0 8px">SBDC Deck Creator</h3>
  <label>Server URL</label>
  <input id="serverUrl" placeholder="http://localhost:8899" value="http://localhost:8899">
  <label>Deck ID</label>
  <input id="deckId" placeholder="my-deck">
  <label>Takes per prompt</label>
  <input id="takes" placeholder="4" value="4" type="number">
  <div class="btn-row">
    <button id="startBtn">Start</button>
    <button id="statusBtn">Status</button>
  </div>
  <div id="status"></div>
  <script src="popup.js"></script>
</body>
</html>
POPHTM_V3_W6yT2

echo "Writing $BASE/sbdc-extension/src/popup.ts (updated for new API)"
cat > "$BASE/sbdc-extension/src/popup.ts" << 'POPTS_V3_Q8fN5'
const serverUrlEl = document.getElementById('serverUrl') as HTMLInputElement;
const deckIdEl = document.getElementById('deckId') as HTMLInputElement;
const takesEl = document.getElementById('takes') as HTMLInputElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const statusBtn = document.getElementById('statusBtn') as HTMLButtonElement;
const statusEl = document.getElementById('status')!;

chrome.storage.local.get(['serverUrl', 'deckId', 'takes'], (res: any) => {
  if (res.serverUrl) serverUrlEl.value = res.serverUrl;
  if (res.deckId) deckIdEl.value = res.deckId;
  if (res.takes) takesEl.value = res.takes;
});

startBtn.addEventListener('click', async () => {
  const url = serverUrlEl.value.replace(/\/$/, '');
  const deck = deckIdEl.value.trim();
  const numTakes = parseInt(takesEl.value, 10) || 4;

  if (!deck) {
    statusEl.textContent = 'Please enter a Deck ID';
    return;
  }

  chrome.storage.local.set({ serverUrl: url, deckId: deck, takes: takesEl.value });
  chrome.runtime.sendMessage({ type: 'SET_SERVER_URL', url });

  statusEl.textContent = 'Starting generation...';

  try {
    const resp = await fetch(url + '/api/decks/' + encodeURIComponent(deck) + '/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takes_per_prompt: numTakes }),
    });

    if (resp.ok) {
      const data = await resp.json();
      statusEl.textContent =
        'Started! ' + (data.prompts_ready || 0) + ' prompts ready.\n' +
        'Takes per prompt: ' + (data.takes_per_prompt || numTakes) + '\n' +
        'Open perchance.org/fluxgen';
    } else {
      const text = await resp.text();
      statusEl.textContent = 'HTTP ' + resp.status + '\n' + text;
    }
  } catch (e: any) {
    statusEl.textContent =
      'FETCH FAILED:\n' + e.message + '\n\nIs server running?\n' +
      'cargo run --bin sbdc -- serve --port 8899';
  }
});

statusBtn.addEventListener('click', async () => {
  const url = serverUrlEl.value.replace(/\/$/, '');
  const deck = deckIdEl.value.trim();

  if (!deck) {
    statusEl.textContent = 'Please enter a Deck ID';
    return;
  }

  statusEl.textContent = 'Checking...';

  try {
    const resp = await fetch(url + '/api/decks/' + encodeURIComponent(deck) + '/status');
    if (resp.ok) {
      const data = await resp.json();
      statusEl.textContent =
        'Deck: ' + data.deck_id + '\n' +
        'Status: ' + data.status + '\n' +
        'Total: ' + data.total_prompts + '\n' +
        'Ready: ' + data.ready_to_generate + '\n' +
        'Generating: ' + data.generating + '\n' +
        'Takes ready: ' + data.takes_ready + '\n' +
        'Cleaned: ' + data.cleaned;
    } else {
      statusEl.textContent = 'HTTP ' + resp.status;
    }
  } catch (e: any) {
    statusEl.textContent = 'FETCH FAILED:\n' + e.message;
  }
});
POPTS_V3_Q8fN5

echo "Checking compilation"
if ! cargo check --workspace --manifest-path "$BASE/Cargo.toml" 2>&1; then
  echo "Compilation failed – will skip commit"
  COMPILE_OK=false
fi

if [ "$INCOMPLETE" = true ] || [ "$COMPILE_OK" = false ]; then
  echo "Skipping tests and commit due to incomplete files or compilation errors"
  exit 1
fi

echo "Running tests"
cargo test --workspace --manifest-path "$BASE/Cargo.toml" 2>&1
if [ $? -eq 0 ]; then
  echo "All tests passed. Committing."
  git add -A
  git commit -m "feat(sbdc): update CLI, extension for new DB-backed API flow

- Remove Generate CLI command (extension drives generation via server)
- Fix Serve command (remove unused deck_id/takes args)
- Rewrite extension content.ts to use /api/decks/{id}/prompts/next and /takes
- Update popup with Status button and new API endpoints
- Add GET_SERVER_URL message to background script"
else
  echo "Tests failed. Fix errors then run the next script."
  exit 1
fi
