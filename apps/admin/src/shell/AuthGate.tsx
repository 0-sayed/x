import { createContext, useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import type { PermissionKey } from '@materiabill/contracts';

import { useCurrentUser, useWorkspaceContext, useWorkspaceSwitcher } from '../api/hooks.js';
import { AppShell } from './AppShell.js';
import { LoginScreen } from './LoginScreen.js';

const WorkspacePermissionsContext = createContext<readonly string[]>([]);

export function AuthGate() {
  const { t } = useTranslation();
  const userQuery = useCurrentUser();
  const isAuthenticated = Boolean(userQuery.data);
  const switcherQuery = useWorkspaceSwitcher(isAuthenticated);
  const contextQuery = useWorkspaceContext(isAuthenticated);

  if (userQuery.isPending) {
    return <main className="center-state">{t('workspace.loading')}</main>;
  }

  if (userQuery.error) {
    return (
      <main className="center-state">
        <p>{t('workspace.loadFailed')}</p>
        <button type="button" className="button secondary" onClick={() => void userQuery.refetch()}>
          {t('workspace.retry')}
        </button>
      </main>
    );
  }

  if (!userQuery.data) {
    return <LoginScreen />;
  }

  const isWorkspaceLoading = switcherQuery.isPending || contextQuery.isPending;

  const accessBlocked = switcherQuery.error?.status === 403 || contextQuery.error?.status === 403;

  if (accessBlocked) {
    return (
      <main className="center-state">
        <p>{t('workspace.accessBlocked')}</p>
      </main>
    );
  }

  if (switcherQuery.error || contextQuery.error) {
    return (
      <main className="center-state">
        <p>{t('workspace.loadFailed')}</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            void switcherQuery.refetch();
            void contextQuery.refetch();
          }}
        >
          {t('workspace.retry')}
        </button>
      </main>
    );
  }

  if (isWorkspaceLoading) {
    return (
      <AppShell
        user={userQuery.data}
        switcher={switcherQuery.data}
        workspaceContext={contextQuery.data}
        isWorkspaceLoading
      >
        <section className="center-state">{t('workspace.loading')}</section>
      </AppShell>
    );
  }

  return (
    <WorkspacePermissionsContext.Provider value={contextQuery.data.membership.permissions}>
      <AppShell
        user={userQuery.data}
        switcher={switcherQuery.data}
        workspaceContext={contextQuery.data}
        isWorkspaceLoading={false}
      >
        <Outlet />
      </AppShell>
    </WorkspacePermissionsContext.Provider>
  );
}

export function PermissionGate({
  children,
  requiredPermission,
}: {
  readonly children: ReactNode;
  readonly requiredPermission: PermissionKey;
}) {
  const { t } = useTranslation();
  const permissions = useContext(WorkspacePermissionsContext);

  if (!permissions.includes(requiredPermission)) {
    return <section className="center-state">{t('workspace.routeBlocked')}</section>;
  }

  return children;
}
