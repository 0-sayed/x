import wtcrc from '../../../.wtcrc.json' with { type: 'json' };
import { describe, expect, it } from 'vitest';

type PortAssignments = Partial<Record<(typeof wtcrc.portVariables)[number], string>>;

function resolveEnvOverrides(
  envOverrides: Record<string, string>,
  portAssignments: PortAssignments,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(envOverrides).map(([name, value]) => [
      name,
      value.replaceAll(/\$\{([A-Z0-9_]+)\}/g, (placeholder, variableName: string) => {
        return portAssignments[variableName] ?? placeholder;
      }),
    ]),
  );
}

describe('worktree compose config', () => {
  it('derives URL env overrides from assigned worktree ports', () => {
    const resolvedEnvOverrides = resolveEnvOverrides(wtcrc.envOverrides, {
      API_PORT: '3100',
      POSTGRES_PORT: '60432',
    });

    expect(resolvedEnvOverrides).toMatchObject({
      DATABASE_URL: 'postgresql://local_user:changeme-local-only@127.0.0.1:60432/materiabill',
      VITE_API_BASE_URL: 'http://127.0.0.1:3100',
    });
    expect(Object.values(resolvedEnvOverrides).every((value) => !value.includes('${'))).toBe(true);
  });
});
