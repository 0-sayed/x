import { useTranslation } from 'react-i18next';

import { useSwitchWorkspace } from '../api/hooks.js';
import type { WorkspaceSwitcherResponse } from '@materiabill/contracts';
import { useToast } from '../ui/toast.js';

type WorkspaceSwitcherProps = {
  readonly switcher: WorkspaceSwitcherResponse | undefined;
};

export function WorkspaceSwitcher({ switcher }: WorkspaceSwitcherProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const switchWorkspace = useSwitchWorkspace();
  const selectedWorkspaceId = switcher?.activeWorkspaceId ?? switcher?.workspaces[0]?.id ?? '';

  return (
    <label className="workspace-switcher">
      <span>{t('shell.workspace')}</span>
      <select
        aria-label={t('shell.workspace')}
        value={selectedWorkspaceId}
        disabled={!switcher || switchWorkspace.isPending}
        onChange={(event) => {
          switchWorkspace.mutate(event.target.value, {
            onError: () => {
              toast.showToast(t('workspace.switchFailed'));
            },
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
