import { useMemo } from 'react';
import { RouterProvider } from 'react-router';

import { AppProviders } from './providers/AppProviders.js';
import { createAdminRouter } from './router.js';

export function App() {
  const router = useMemo(() => createAdminRouter(), []);

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
