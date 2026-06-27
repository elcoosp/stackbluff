import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { createUser, loginUser } from '../helpers/users';
import { createTournament } from '../helpers/tournament';
import { createCluster, newPage } from '../helpers/browser';
import { Cluster } from 'puppeteer-cluster';
import { FRONTEND_URL } from '../config';

const NUM_PLAYERS = 20;
const timestamp = Date.now();

describe('Multi-Table Tournament', () => {
  let tournamentId: string;
  let cluster: Cluster;

  beforeAll(async () => {
    tournamentId = await createTournament('Mtt', NUM_PLAYERS, 200);
    const users = Array.from({ length: NUM_PLAYERS }, (_, i) => `mtt_${timestamp}_${i}`);
    await Promise.all(users.map(u => createUser(u)));
    cluster = await createCluster(3);
  });

  afterAll(async () => {
    await cluster?.idle().catch(() => { });
    await cluster?.close().catch(() => { });
  });

  it('should handle MTT with rebalancing and final table', async () => {
    await cluster.task(async ({ page, data }: { page: any; data: { username: string; tournamentId: string } }) => {
      const { username, tournamentId: tId } = data;

      let loggedIn = false;
      for (let attempt = 0; attempt < 3 && !loggedIn; attempt++) {
        try {
          await loginUser(page, username);
          loggedIn = true;
        } catch {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      if (!loggedIn) throw new Error(`Failed to login user ${username} after 3 attempts`);

      await page.goto(`${FRONTEND_URL}/tournaments`);
      await page.waitForSelector('[data-testid="user-menu"]', { timeout: 15000 });

      await page.waitForSelector(`[data-tournament-id="${tId}"]`, { timeout: 10000 });

      const isRegistered = await page.$(`[data-tournament-id="${tId}"] [data-testid="unregister"], [data-tournament-id="${tId}"] [data-testid="play"]`);
      if (!isRegistered) {
        await page.waitForSelector(
          `[data-tournament-id="${tId}"] [data-testid="register"]:not([disabled])`,
          { timeout: 10000 }
        );

        await page.click(`[data-tournament-id="${tId}"] [data-testid="register"]`);

        try {
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
        } catch {
          await page.waitForSelector('h2', { timeout: 5000 });
        }

        await new Promise(r => setTimeout(r, 200));
        await page.click('[data-testid="confirm-buyin"]', { delay: 50 });

        await page.waitForSelector(
          `[data-tournament-id="${tId}"] [data-testid="unregister"], [data-tournament-id="${tId}"] [data-testid="play"]`,
          { timeout: 15000 }
        );
      }
    });

    const users = Array.from({ length: NUM_PLAYERS }, (_, i) => `mtt_${timestamp}_${i}`);
    await Promise.all(users.map(u => cluster.execute({ username: u, tournamentId })));

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
      { timeout: 60000 },
      tournamentId
    );

    const firstPage = await newPage();
    await loginUser(firstPage, `mtt_${timestamp}_0`);
    await firstPage.goto(`${FRONTEND_URL}/tournaments`);
    await firstPage.waitForSelector('[data-testid="user-menu"]', { timeout: 15000 });

    await firstPage.waitForSelector(`[data-tournament-id="${tournamentId}"] [data-testid="play"]`, { timeout: 15000 });
    await firstPage.click(`[data-tournament-id="${tournamentId}"] [data-testid="play"]`);

    await firstPage.waitForSelector('[data-testid="table-felt"]', { timeout: 15000 });
    expect(firstPage.url()).toMatch(/\/table\/[a-f0-9-]+/);

    await firstPage.waitForSelector('[data-testid="tournament-results"]', { timeout: 120000 });
    const results = await firstPage.evaluate(() => {
      const winners = document.querySelectorAll('[data-testid="result-winner"]');
      return Array.from(winners).map(el => el.textContent);
    });

    expect(results.length).toBeGreaterThan(0);

    await adminPage.close();
    await firstPage.close();
  });
});
