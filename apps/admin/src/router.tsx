import { createBrowserRouter } from 'react-router';

import { ShellHome } from './pages/ShellHome.js';
import { ShellPlaceholder } from './pages/ShellPlaceholder.js';
import { AuthGate, PermissionGate } from './shell/AuthGate.js';

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
          element: (
            <PermissionGate requiredPermission="projects.view">
              <ShellPlaceholder titleKey="shell.projects" />
            </PermissionGate>
          ),
        },
        {
          path: 'activity',
          element: (
            <PermissionGate requiredPermission="audit.view">
              <ShellPlaceholder titleKey="shell.activity" />
            </PermissionGate>
          ),
        },
        {
          path: 'people',
          element: (
            <PermissionGate requiredPermission="people.view">
              <ShellPlaceholder titleKey="shell.people" />
            </PermissionGate>
          ),
        },
        {
          path: 'settings',
          element: (
            <PermissionGate requiredPermission="settings.view">
              <ShellPlaceholder titleKey="shell.settings" />
            </PermissionGate>
          ),
        },
      ],
    },
  ]);
}
