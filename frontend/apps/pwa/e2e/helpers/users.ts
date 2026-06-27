import { Page } from 'puppeteer';
import { apiClient } from './api';
import { FRONTEND_URL } from '../config';

export async function createUser(username: string, password = 'Test123!') {
  const email = `${username}@test.com`;
  const res = await apiClient<{ user_id: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  return res.user_id;
}

export async function loginUser(page: Page, username: string, password = 'Test123!') {
  await page.goto(`${FRONTEND_URL}/login`);
  await page.waitForSelector('#email', { timeout: 5000 });
  await page.type('#email', `${username}@test.com`);
  await page.type('#password', password);

  // Click by finding the button by text content — works regardless of custom button components
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent?.trim().includes('SIGN IN')) {
        btn.click();
        return;
      }
    }
  });

  // Wait for auth state to be ready on the redirected page
  await page.waitForSelector('[data-testid="user-menu"]', { timeout: 15000 });
}
