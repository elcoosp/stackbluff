import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { createUser, loginUser } from '../helpers/users';
import { createTournament } from '../helpers/tournament';
import { newPage } from '../helpers/browser';
import { Page } from 'puppeteer';
import { FRONTEND_URL } from '../config';

const NUM_PLAYERS = 2;
const timestamp = Date.now();

describe('Sit & Go Tournament', () => {
  let tournamentId: string;
  let pages: Page[] = [];

  beforeAll(async () => {
    tournamentId = await createTournament('SitAndGo', NUM_PLAYERS, 100);
  });

  afterAll(async () => {
    for (const page of pages) {
      const ctx = page.browserContext();
      await page.close().catch(() => { });
      await ctx.close().catch(() => { });
    }
  });

  it('should allow 2 players to register and complete a tournament', async () => {
    for (let i = 0; i < NUM_PLAYERS; i++) {
      const username = `sng_${timestamp}_${i}`;
      await createUser(username);
      const page = await newPage();
      pages.push(page);

      await loginUser(page, username);

      await page.goto(`${FRONTEND_URL}/tournaments`);
      await page.waitForSelector('[data-testid="user-menu"]', { timeout: 15000 });

      await page.waitForSelector(`[data-tournament-id="${tournamentId}"]`, { timeout: 10000 });

      const isRegistered = await page.$(`[data-tournament-id="${tournamentId}"] [data-testid="unregister"], [data-tournament-id="${tournamentId}"] [data-testid="play"]`);
      if (!isRegistered) {
        await page.waitForSelector(
          `[data-tournament-id="${tournamentId}"] [data-testid="register"]:not([disabled])`,
          { timeout: 10000 }
        );

        await page.click(`[data-tournament-id="${tournamentId}"] [data-testid="register"]`);

        await page.waitForFunction(() => {
          const btn = document.querySelector('[data-testid="confirm-buyin"]') as HTMLButtonElement | null;
          if (!btn) return false;
          if (btn.disabled) return false;
          if (btn.getAttribute('aria-disabled') === 'true') return false;
          const style = window.getComputedStyle(btn);
          if (style.pointerEvents === 'none' || style.visibility === 'hidden' || style.display === 'none') return false;
          const rect = btn.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }, { timeout: 10000 });

        await new Promise(r => setTimeout(r, 200));
        await page.click('[data-testid="confirm-buyin"]', { delay: 50 });

        await page.waitForSelector(
          `[data-tournament-id="${tournamentId}"] [data-testid="unregister"], [data-tournament-id="${tournamentId}"] [data-testid="play"]`,
          { timeout: 15000 }
        );
      }
    }

    const adminPage = await newPage();
    const adminUsername = `admin_${timestamp}`;
    await createUser(adminUsername);
    await loginUser(adminPage, adminUsername);

    await adminPage.goto(`${FRONTEND_URL}/tournaments`);
    await adminPage.waitForSelector('[data-testid="user-menu"]', { timeout: 15000 });
    await adminPage.waitForFunction(
      (id) => {
        const el = document.querySelector(`[data-tournament-id="${id}"] [data-testid="tournament-status"]`);
        return el && el.textContent?.trim() === 'Live';
      },
      { timeout: 30000 },
      tournamentId
    );

    for (const page of pages) {
      await page.goto(`${FRONTEND_URL}/tournaments`);
      await page.waitForSelector('[data-testid="user-menu"]', { timeout: 15000 });
      await page.waitForSelector(`[data-tournament-id="${tournamentId}"] [data-testid="play"]`, { timeout: 15000 });
      await page.click(`[data-tournament-id="${tournamentId}"] [data-testid="play"]`);
      await page.waitForSelector('[data-testid="table-felt"]', { timeout: 15000 });
      expect(page.url()).toMatch(/\/table\/[a-f0-9-]+/);
    }

    await pages[0].waitForSelector('[data-testid="tournament-results"]', { timeout: 60000 });
    const results = await pages[0].evaluate(() => {
      const winners = document.querySelectorAll('[data-testid="result-winner"]');
      return Array.from(winners).map(el => el.textContent);
    });

    expect(results.length).toBe(1);
    await adminPage.close();
  });
});
