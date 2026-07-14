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

async function loadLocale(locale: string) {
  // Import the compiled .mjs catalog (ES module output)
  const { messages } = await import(`./locales/${locale}/messages.mjs`);
  i18n.load(locale, messages);
  i18n.activate(locale);
}

const defaultLocale = 'en';
await loadLocale(defaultLocale);

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
