import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { useState, type ReactNode } from 'react';

import { ApiClientContext } from '../api/hooks.js';
import { createApiClient, type ApiClient } from '../api/client.js';
import { i18n } from '../i18n/i18n.js';
import { ConfirmProvider } from '../ui/confirm.js';
import { ToastProvider } from '../ui/toast.js';

export function AppProviders({
  children,
  apiClient,
}: {
  readonly children: ReactNode;
  readonly apiClient?: ApiClient;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const [defaultApiClient] = useState(() => createApiClient());
  const resolvedApiClient = apiClient ?? defaultApiClient;

  return (
    <ApiClientContext.Provider value={resolvedApiClient}>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </ApiClientContext.Provider>
  );
}
