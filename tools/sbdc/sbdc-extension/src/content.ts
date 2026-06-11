let polling = false;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'START_POLLING') {
    polling = true;
    pollLoop();
  }
});

async function pollLoop() {
  while (polling) {
    const task = await chrome.runtime.sendMessage({ type: 'GET_NEXT_PROMPT' });
    if (!task || task.status === 'DONE') {
      polling = false;
      break;
    }

    const iframe = document.querySelector('iframe');
    const doc = iframe?.contentDocument || document;
    await waitForElement(doc, 'textarea[data-name="description"]');

    setTextarea(doc, 'textarea[data-name="description"]', task.positive);
    if (task.negative) {
      expandNegative(doc);
      setTextarea(doc, 'textarea[data-name="negative"]', task.negative);
    }

    const shapeSelect = doc.querySelector('select[data-name="shape"]');
    if (shapeSelect && task.shape) {
      shapeSelect.value = task.shape;
      shapeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const generateBtn = doc.querySelector('#generateButtonEl') as HTMLElement;
    generateBtn.click();

    const outputArea = doc.querySelector('#outputAreaEl');
    const initialImgs = outputArea?.querySelectorAll('img').length || 0;
    await waitForImages(doc, initialImgs + 1);

    const images = await collectNewImages(doc, initialImgs);

    await chrome.runtime.sendMessage({
      type: 'SUBMIT_RESULT',
      promptId: task.prompt_id,
      images,
      take: task.take,
    });

    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
  }
}

function setTextarea(doc: Document, selector: string, value: string) {
  const el = doc.querySelector(selector) as HTMLTextAreaElement;
  if (!el) return;
  el.focus();
  document.execCommand('insertText', false, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function expandNegative(doc: Document) {
  const container = doc.querySelector('textarea[data-name="negative"]')?.closest('.input-ctn');
  if (container?.dataset.foldToggleState === 'hidden') {
    container.dataset.foldToggleState = 'shown';
  }
}

async function waitForElement(doc: Document, selector: string): Promise<void> {
  while (!doc.querySelector(selector)) {
    await new Promise(r => setTimeout(r, 200));
  }
}

async function waitForImages(doc: Document, minCount: number): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const imgs = doc.querySelectorAll('#outputAreaEl img');
      if (imgs.length >= minCount && [...imgs].every(img => img.complete && img.naturalHeight > 0)) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
  });
}

async function collectNewImages(doc: Document, previousCount: number): Promise<string[]> {
  const imgs = doc.querySelectorAll('#outputAreaEl img');
  const newImages: string[] = [];
  for (let i = previousCount; i < imgs.length; i++) {
    const src = imgs[i].src;
    if (src.startsWith('data:')) {
      newImages.push(src);
    } else {
      const blob = await fetch(src).then(r => r.blob());
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      newImages.push(data);
    }
  }
  return newImages;
}
