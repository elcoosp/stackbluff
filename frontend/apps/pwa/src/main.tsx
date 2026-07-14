import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeedbackProvider } from '@stackbluff/shared/components/feedback/FeedbackProvider';
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';
import { initSentry } from './lib/sentry';
import './index.css';

// --- 1. Load default locale synchronously (still safe because no components are imported yet) ---
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

// --- 3. Root app that dynamically imports the router AFTER locale is ready ---
function RootApp() {
  const [isReady, setIsReady] = useState(false);
  const [RouterComponent, setRouterComponent] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    async function init() {
      // Ensure default locale is active (already done, but re-activate to be safe)
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

      // --- 4. Dynamically import the router and its routes ---
      // This ensures that all route components (and their module-level code)
      // are imported AFTER locale activation.
      const { RouterProvider, createRouter } = await import('@tanstack/react-router');
      const { routeTree } = await import('./routeTree.gen');
      const router = createRouter({ routeTree });

      // Create a component that provides the router
      const Router = () => <RouterProvider router={router} />;
      setRouterComponent(() => Router);
      setIsReady(true);
    }

    init();
  }, []);

  if (!isReady || !RouterComponent) {
    return <LoadingSpinner />;
  }

  // --- 5. Build query client (moved here to avoid early instantiation) ---
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
    },
  });

  initSentry();

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
  </React.StrictMode>
);
