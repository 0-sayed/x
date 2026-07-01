import { Languages, LogOut } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  CurrentSessionUser,
  WorkspaceContext,
  WorkspaceSwitcherResponse,
} from '@materiabill/contracts';

import { useLogout } from '../api/hooks.js';
import { useConfirm } from '../ui/confirm.js';
import { useToast } from '../ui/toast.js';
import { GlobalNav } from './GlobalNav.js';
import { WorkspaceSwitcher } from './WorkspaceSwitcher.js';

type AppShellProps = {
  readonly user: CurrentSessionUser;
  readonly switcher?: WorkspaceSwitcherResponse;
  readonly workspaceContext?: WorkspaceContext;
  readonly isWorkspaceLoading: boolean;
  readonly children: ReactNode;
};

export function AppShell({
  user,
  switcher,
  workspaceContext,
  isWorkspaceLoading,
  children,
}: AppShellProps) {
  const { i18n, t } = useTranslation();
  const { confirm } = useConfirm();
  const logout = useLogout();
  const { showToast } = useToast();
  const permissions = workspaceContext?.membership.permissions ?? [];
  const displayName = user.displayName ?? user.email;

  async function handleLogout(): Promise<void> {
    const confirmed = await confirm({
      title: t('confirm.signOutTitle'),
      message: t('confirm.signOutMessage'),
    });

    if (!confirmed) {
      return;
    }

    await logout.mutateAsync();
    showToast(t('toast.signedOut'));
  }

  return (
    <div className="admin-shell">
      <aside className="shell-sidebar">
        <div className="brand-mark">{t('appName')}</div>
        <GlobalNav permissions={permissions} />
      </aside>
      <div className="shell-main">
        <header className="shell-topbar">
          <WorkspaceSwitcher switcher={switcher} />
          <div className="topbar-actions">
            <span className="workspace-loading" aria-live="polite">
              {isWorkspaceLoading ? t('workspace.loading') : null}
            </span>
            <button
              type="button"
              className="icon-text-button"
              onClick={() => void i18n.changeLanguage(i18n.resolvedLanguage === 'ar' ? 'en' : 'ar')}
            >
              <Languages aria-hidden="true" size={18} />
              {i18n.resolvedLanguage === 'ar' ? t('language.english') : t('language.arabic')}
            </button>
            <div className="user-chip">
              <span>{t('shell.signedInAs')}</span>
              <strong>{displayName}</strong>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={t('shell.signOut')}
              disabled={logout.isPending}
              onClick={() => void handleLogout()}
            >
              <LogOut aria-hidden="true" size={18} />
            </button>
          </div>
        </header>
        <main className="content-frame">{children}</main>
      </div>
    </div>
  );
}
