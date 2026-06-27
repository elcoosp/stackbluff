import puppeteer, { Browser } from 'puppeteer';
import { Cluster } from 'puppeteer-cluster';

let browser: Browser;

export async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({ headless: 'new' });
  }
  return browser;
}

export async function newPage() {
  const browser = await getBrowser();
  // Create an incognito context to isolate cookies/localStorage per user
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  return page;
}

export const createCluster = (concurrency: number) =>
  Cluster.launch({
    // Use CONTEXT concurrency to isolate cookies per task
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: concurrency,
    puppeteerOptions: { headless: 'new' },
  });
