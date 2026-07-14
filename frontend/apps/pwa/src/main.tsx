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

// --- 1. STATICALLY IMPORT DEFAULT LOCALE ---
import { messages as enMessages } from './locales/en/messages.mjs';

// --- 2. ACTIVATE DEFAULT LOCALE IMMEDIATELY ---
i18n.load('en', enMessages);
i18n.activate('en');

// --- 3. Load stored locale (if different) asynchronously ---
const storedLocale = localStorage.getItem('stackbluff-language') || 'en';
if (storedLocale !== 'en') {
  import(`./locales/${storedLocale}/messages.mjs`)
    .then(({ messages }) => {
      i18n.load(storedLocale, messages);
      i18n.activate(storedLocale);
    })
    .catch(() => console.warn(`Failed to load locale: ${storedLocale}`));
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
