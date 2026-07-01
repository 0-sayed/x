import { createBrowserRouter } from 'react-router';

import { ShellHome } from './pages/ShellHome.js';
import { ShellPlaceholder } from './pages/ShellPlaceholder.js';
import { AuthGate } from './shell/AuthGate.js';

export function createAdminRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: <AuthGate />,
      children: [
        {
          index: true,
          element: <ShellHome />,
        },
        {
          path: 'projects',
          element: <ShellPlaceholder titleKey="shell.projects" />,
        },
        {
          path: 'activity',
          element: <ShellPlaceholder titleKey="shell.activity" />,
        },
        {
          path: 'people',
          element: <ShellPlaceholder titleKey="shell.people" />,
        },
        {
          path: 'settings',
          element: <ShellPlaceholder titleKey="shell.settings" />,
        },
      ],
    },
  ]);
}
