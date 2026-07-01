import { useTranslation } from 'react-i18next';

import { useSwitchWorkspace } from '../api/hooks.js';
import type { WorkspaceSwitcherResponse } from '@materiabill/contracts';
import { useToast } from '../ui/toast.js';

type WorkspaceSwitcherProps = {
  readonly switcher: WorkspaceSwitcherResponse | undefined;
};

export function WorkspaceSwitcher({ switcher }: WorkspaceSwitcherProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const switchWorkspace = useSwitchWorkspace();

  return (
    <label className="workspace-switcher">
      <span>{t('shell.workspace')}</span>
      <select
        aria-label={t('shell.workspace')}
        value={switcher?.activeWorkspaceId ?? ''}
        disabled={!switcher || switchWorkspace.isPending}
        onChange={(event) => {
          switchWorkspace.mutate(event.target.value, {
            onError: () => showToast(t('workspace.switchFailed')),
          });
        }}
      >
        {(switcher?.workspaces ?? []).map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
    </label>
  );
}
