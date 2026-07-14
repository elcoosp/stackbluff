import { initSentry } from './lib/sentry';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeedbackProvider } from '@stackbluff/shared/components/feedback/FeedbackProvider';
import { routeTree } from './routeTree.gen';
import './index.css';
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';

// --- 1. Import default locale messages statically (synchronous) ---
// This ensures the default locale is activated before any component uses t.
import { messages as enMessages } from './locales/en/messages.mjs';

// --- 2. Activate default locale immediately ---
i18n.load('en', enMessages);
i18n.activate('en');

// --- 3. Async loader for other locales (on-demand) ---
async function loadLocale(locale: string) {
  if (locale === 'en') return; // already loaded
  const { messages } = await import(`./locales/${locale}/messages.mjs`);
  i18n.load(locale, messages);
  i18n.activate(locale);
}

// --- 4. Optionally, load the user's preferred locale from storage ---
const storedLocale = localStorage.getItem('stackbluff-language') || 'en';
if (storedLocale !== 'en') {
  loadLocale(storedLocale).catch(console.error);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
  },
});

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <FeedbackProvider>
          <RouterProvider router={router} />
        </FeedbackProvider>
      </QueryClientProvider>
    </I18nProvider>
  </React.StrictMode>,
);
