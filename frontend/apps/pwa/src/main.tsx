import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { FeedbackProvider } from '@stackbluff/shared/components/feedback/FeedbackProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// --- 1. Load default locale synchronously ---
import { messages as enMessages } from './locales/en/messages.mjs';

i18n.load('en', enMessages);
i18n.activate('en');

// --- 2. Loading component ---
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a] text-white">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-tertiary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-on-surface-variant">Loading...</p>
      </div>
    </div>
  );
}

// --- 3. Root app with lazy router and one-time Sentry init ---
function RootApp() {
  const [isReady, setIsReady] = useState(false);
  const [RouterComponent, setRouterComponent] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    let sentryInitialized = false;

    async function init() {
      // Ensure default locale is active
      i18n.activate('en');

      // Load stored locale preference (if any and different from 'en')
      const storedLocale = localStorage.getItem('stackbluff-language');
      if (storedLocale && storedLocale !== 'en') {
        try {
          const { messages } = await import(`./locales/${storedLocale}/messages.mjs`);
          i18n.load(storedLocale, messages);
          i18n.activate(storedLocale);
        } catch (err) {
          console.warn(`Failed to load locale: ${storedLocale}`, err);
        }
      }

      // --- 4. Initialize Sentry only once (guard inside the module) ---
      if (!sentryInitialized) {
        const { initSentry } = await import('./lib/sentry');
        initSentry();
        sentryInitialized = true;
      }

      // --- 5. Dynamically import the router ---
      const { RouterProvider, createRouter } = await import('@tanstack/react-router');
      const { routeTree } = await import('./routeTree.gen');
      const router = createRouter({ routeTree });
      const Router = () => <RouterProvider router={router} />;
      setRouterComponent(() => Router);
      setIsReady(true);
    }

    init();
  }, []);

  if (!isReady || !RouterComponent) {
    return <LoadingSpinner />;
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
    },
  });

  return (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <FeedbackProvider>
          <RouterComponent />
        </FeedbackProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}

// --- 6. Mount ---
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
);
