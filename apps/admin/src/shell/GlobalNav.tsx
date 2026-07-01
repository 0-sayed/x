import { Activity, FolderKanban, Home, Settings, Users } from 'lucide-react';
import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';

type NavItem = {
  readonly to: string;
  readonly labelKey: string;
  readonly permission?: string;
  readonly icon: typeof Home;
};

const navItems: readonly NavItem[] = [
  { to: '/', labelKey: 'shell.home', icon: Home },
  { to: '/projects', labelKey: 'shell.projects', permission: 'projects.view', icon: FolderKanban },
  { to: '/activity', labelKey: 'shell.activity', permission: 'audit.view', icon: Activity },
  { to: '/people', labelKey: 'shell.people', permission: 'people.view', icon: Users },
  { to: '/settings', labelKey: 'shell.settings', permission: 'settings.view', icon: Settings },
];

export function GlobalNav({ permissions }: { readonly permissions: readonly string[] }) {
  const { t } = useTranslation();
  const permissionSet = new Set(permissions);

  return (
    <nav className="global-nav" aria-label="Primary">
      {navItems
        .filter((item) => !item.permission || permissionSet.has(item.permission))
        .map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              end={item.to === '/'}
              to={item.to}
              key={item.to}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          );
        })}
    </nav>
  );
}
