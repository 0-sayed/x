import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { useCurrentUser, useWorkspaceContext, useWorkspaceSwitcher } from '../api/hooks.js';
import { AppShell } from './AppShell.js';
import { LoginScreen } from './LoginScreen.js';

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

  return (
    <AppShell
      user={userQuery.data}
      switcher={switcherQuery.data}
      workspaceContext={contextQuery.data}
      isWorkspaceLoading={switcherQuery.isPending || contextQuery.isPending}
    >
      <Outlet />
    </AppShell>
  );
}
