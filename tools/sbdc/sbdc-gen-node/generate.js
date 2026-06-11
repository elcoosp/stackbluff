const puppeteer = require('puppeteer');
const fs = require('fs');

const POS_SELECTOR = '#userInputsCtn8462746262 > div:nth-child(2) > div > div.input-wrapper > div:nth-child(1) > textarea';
const NEG_SELECTOR = '#userInputsCtn8462746262 > div:nth-child(3) > div > div.input-wrapper > div > textarea';
const SHAPE_SELECTOR = '#userInputsCtn8462746262 > div:nth-child(6) > div > div.input-wrapper > select';

async function generateImage(browser, prompt, negative, shape, outputPath) {
  const page = await browser.newPage();
  try {
    await page.goto('https://perchance.org/fluxgen', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector(POS_SELECTOR, { timeout: 30000 });
    await page.click(POS_SELECTOR, { clickCount: 3 });
    await page.keyboard.type(prompt, { delay: 5 });
    const negField = await page.$(NEG_SELECTOR);
    if (negField) {
      await page.click(NEG_SELECTOR, { clickCount: 3 });
      await page.keyboard.type(negative || '', { delay: 5 });
    }
    const shapeField = await page.$(SHAPE_SELECTOR);
    if (shapeField && shape) {
      await page.select(SHAPE_SELECTOR, shape);
    }
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent.toLowerCase());
      if (text.includes('generate')) { await btn.click(); break; }
    }
    await page.waitForSelector('img[alt*="generated"], img[src^="data:"], img[src^="blob:"]', { timeout: 120000 });
    const img = await page.$('img[alt*="generated"], img[src^="data:"], img[src^="blob:"]');
    if (!img) throw new Error('Image not found after generation');
    const src = await img.evaluate(el => el.src);
    if (src.startsWith('data:')) {
      const base64 = src.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'));
    } else {
      const response = await page.goto(src);
      fs.writeFileSync(outputPath, await response.buffer());
    }
    return true;
  } finally {
    await page.close();
  }
}

async function main() {
  let inputData = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) { inputData += chunk; }
  const manifest = JSON.parse(inputData);
  const outputDir = process.argv[2] || './output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const results = [];
  for (const item of manifest) {
    try {
      const outPath = `${outputDir}/prompt_${item.prompt_id}_take.png`;
      await generateImage(browser, item.positive, item.negative, item.shape || '1:1', outPath);
      results.push({ prompt_id: item.prompt_id, file_path: outPath, success: true });
    } catch (e) {
      results.push({ prompt_id: item.prompt_id, file_path: null, success: false, error: e.message });
    }
  }
  await browser.close();
  console.log(JSON.stringify(results));
}
main().catch(e => { console.error(e); process.exit(1); });
