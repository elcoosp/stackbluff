(function () {
  const PORT = 8899;
  const NUM_IMAGES = 15;
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

  async function waitForUI(): Promise<boolean> {
    for (let i = 0; i < 120; i++) {
      if (document.querySelector('textarea[data-name="description"]') && document.querySelector('#generateButtonEl')) {
        log('✅ UI found after ' + i + 's');
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

  (async () => {
    if (!await waitForUI()) return;

    setIndicator('green', '[SBDC] UI ready! Checking server...');
    log('✅ UI ready!');

    async function serverFetch(urlPath: string, method?: string, body?: string): Promise<any> {
      log('→ FETCH ' + (method || 'GET') + ' ' + urlPath);
      try {
        const resp: any = await chrome.runtime.sendMessage({
          type: 'FETCH',
          url: 'http://localhost:' + PORT + urlPath,
          method: method || 'GET',
          body: body || null
        });
        log('← FETCH response: ' + JSON.stringify(resp).substring(0, 200));
        if (!resp) throw new Error('No response from background');
        if (!resp.ok) throw new Error(resp.error || 'Fetch failed');
        return resp.data;
      } catch (e: any) {
        log('✗ FETCH ERROR: ' + e.message);
        throw e;
      }
    }

    let ready = false;
    while (!ready) {
      try {
        const status = await serverFetch('/status');
        log('Status: ' + JSON.stringify(status));
        if (status && status.loaded) {
          ready = true;
          log('✅ ' + status.total + ' prompts loaded!');
          setIndicator('green', '[SBDC] ' + status.total + ' prompts! Starting...');
        } else {
          log('Server OK but no prompts. Use popup.');
          setIndicator('orange', '[SBDC] No prompts — click Start');
        }
      } catch (e: any) {
        log('Server not reachable: ' + e.message);
        setIndicator('darkred', '[SBDC] No server');
      }
      if (!ready) await new Promise(r => setTimeout(r, 3000));
    }

    function fillTextarea(selector: string, value: string): boolean {
      const el = document.querySelector(selector) as HTMLTextAreaElement | null;
      if (!el) { log('❌ Not found: ' + selector); return false; }
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

    while (true) {
      let item: any;
      try { item = await serverFetch('/next'); }
      catch (e: any) {
        log('Server lost: ' + e.message);
        setIndicator('darkred', '[SBDC] Server lost');
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      if (item && item.status === 'waiting') {
        setIndicator('orange', '[SBDC] Waiting for prompts...');
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      if (!item || item === null) {
        log('🎉 ALL PROMPTS COMPLETE!');
        setIndicator('blue', '[SBDC] ✅ ALL DONE!');
        break;
      }

      log('═══ prompt_id=' + item.prompt_id + ' ═══');
      setIndicator('green', '[SBDC] Prompt ' + item.prompt_id);

      const ns = document.querySelector('select[data-name="numImages"]') as HTMLSelectElement | null;
      if (ns) { ns.value = String(NUM_IMAGES); ns.dispatchEvent(new Event('change', { bubbles: true })); }

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
      log('Generating ' + NUM_IMAGES + ' (before: ' + before + ')...');
      setIndicator('darkgreen', '[SBDC] Generating ' + item.prompt_id + '...');
      document.querySelector('#generateButtonEl')!.click();

      await new Promise<void>(resolve => {
        const iv = setInterval(() => {
          const imgs = document.querySelectorAll('#outputAreaEl img');
          if (imgs.length >= before + NUM_IMAGES) {
            let ok = true;
            for (let i = before; i < before + NUM_IMAGES; i++) {
              if (!(imgs[i] as HTMLImageElement).complete || (imgs[i] as HTMLImageElement).naturalHeight === 0) { ok = false; break; }
            }
            if (ok) { clearInterval(iv); resolve(); }
          }
        }, 1000);
      });
      log('Images loaded!');

      const imgs = document.querySelectorAll('#outputAreaEl img');
      const images: Array<{ index: number; data: string }> = [];
      for (let i = before; i < before + NUM_IMAGES; i++) {
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
          } catch { log('⚠️ Image fetch failed'); }
        }
      }

      try {
        await serverFetch('/result', 'POST', JSON.stringify({ prompt_id: item.prompt_id, images }));
        log('✅ Sent!');
      } catch (e: any) { log('❌ Send failed: ' + e.message); }

      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
    }
  })();
})();
