import puppeteer, { Browser } from 'puppeteer';
import { Cluster } from 'puppeteer-cluster';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({ headless: true });
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
    puppeteerOptions: { headless: true },
  });

export async function closeBrowser(): Promise<void> {
  if (browser) {
    try {
      await browser.close();
      browser = null;
    } catch (error) {
      console.error('Failed to close browser:', error);
      // Force cleanup even if close fails
      browser = null;
    }
  }
}
