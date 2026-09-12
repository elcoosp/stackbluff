import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { type RenderOptions, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { messages } from '../locales/en/messages.mjs';

const i18n = setupI18n({
  locale: 'en',
  messages: { en: messages },
});

export function renderWithI18n(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>, options);
}
