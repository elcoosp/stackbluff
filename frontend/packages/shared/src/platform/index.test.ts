import { describe, it, expect, vi } from 'vitest';
import { getPlatform, PwaPlatform, TelegramPlatform } from './index';

describe('Platform API', () => {
  it('returns PwaPlatform when not in Telegram', () => {
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;
    global.window = {} as Window;

    const platform = getPlatform();
    expect(platform).toBeInstanceOf(PwaPlatform);

    global.window = originalWindow;
  });

  it('returns TelegramPlatform when Telegram WebApp is present', () => {
    const originalWindow = global.window;
    const mockTelegram = { WebApp: { ready: vi.fn() } };
    global.window = { Telegram: mockTelegram } as Window;

    const platform = getPlatform();
    expect(platform).toBeInstanceOf(TelegramPlatform);

    global.window = originalWindow;
  });
});
