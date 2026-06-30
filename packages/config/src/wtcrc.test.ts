import wtcrc from '../../../.wtcrc.json' with { type: 'json' };
import { describe, expect, it } from 'vitest';

describe('worktree compose config', () => {
  it('derives database URLs from assigned Postgres ports', () => {
    expect(wtcrc.envOverrides).toMatchObject({
      DATABASE_URL:
        'postgresql://local_user:changeme-local-only@127.0.0.1:${POSTGRES_PORT}/materiabill',
    });
  });
});
