import {
  notificationDeliveries,
  notificationPreferences,
  notifications,
  workspaceMembershipRefs,
} from '@materiabill/db';
import { describe, expect, it, vi } from 'vitest';

import {
  notificationChannels,
  notificationEventTypes,
  NotificationsRepository,
} from './notifications.repository.js';

type InsertCall = {
  table: unknown;
  valuesArgs: unknown[];
  onConflictArgs: unknown[];
};

type UpdateCall = {
  table: unknown;
  setArgs: unknown[];
  whereArgs: unknown[];
  returningArgs: unknown[];
};

type DbMockOptions = {
  selectResults?: unknown[][];
  updateResults?: unknown[][];
  insertReturningFactory?: (table: unknown, values: unknown) => unknown[] | undefined;
};

function collectLeaves(value: unknown, seen = new Set<unknown>()): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }

  if (value instanceof Date) {
    return [value.toISOString()];
  }

  if (typeof value !== 'object') {
    return [];
  }

  if (seen.has(value)) {
    return [];
  }
  seen.add(value);

  return Reflect.ownKeys(value).flatMap((key) =>
    collectLeaves((value as Record<PropertyKey, unknown>)[key], seen),
  );
}

function createDbMock({
  selectResults = [[]],
  updateResults = [[]],
  insertReturningFactory,
}: DbMockOptions = {}) {
  const insertCalls: InsertCall[] = [];
  const updateCalls: UpdateCall[] = [];
  const selectWhereArgs: unknown[] = [];
  const txInsertCalls: InsertCall[] = [];
  const txSelectWhereArgs: unknown[] = [];

  let selectResultIndex = 0;
  let updateResultIndex = 0;

  const makeSelectBuilder = (whereArgs: unknown[]) => {
    const builder = {
      from: vi.fn(),
      where: vi.fn((condition: unknown) => {
        whereArgs.push(condition);
        return builder;
      }),
      orderBy: vi.fn(),
      limit: vi.fn(() => {
        const result = selectResults[selectResultIndex] ?? [];
        selectResultIndex += 1;
        return Promise.resolve(result);
      }),
      then: vi.fn((resolve: (value: unknown) => unknown) => {
        const result = selectResults[selectResultIndex] ?? [];
        selectResultIndex += 1;
        return Promise.resolve(resolve(result));
      }),
    };

    builder.from.mockReturnValue(builder);
    builder.orderBy.mockReturnValue(builder);

    return builder;
  };

  const topLevelSelectBuilder = makeSelectBuilder(selectWhereArgs);
  const txSelectBuilder = makeSelectBuilder(txSelectWhereArgs);

  const makeInsert = (calls: InsertCall[]) => (table: unknown) => {
    const call: InsertCall = { table, valuesArgs: [], onConflictArgs: [] };
    calls.push(call);

    return {
      values: vi.fn((values: unknown) => {
        call.valuesArgs.push(values);

        return {
          onConflictDoUpdate: vi.fn((args: unknown) => {
            call.onConflictArgs.push(args);

            return {
              returning: vi.fn(() =>
                Promise.resolve(
                  insertReturningFactory?.(table, values) ??
                    (Array.isArray(values) ? values : [values]),
                ),
              ),
            };
          }),
          returning: vi.fn(() =>
            Promise.resolve(
              insertReturningFactory?.(table, values) ??
                (Array.isArray(values) ? values : [values]),
            ),
          ),
        };
      }),
    };
  };

  const makeUpdate = () => (table: unknown) => {
    const call: UpdateCall = { table, setArgs: [], whereArgs: [], returningArgs: [] };
    updateCalls.push(call);

    return {
      set: vi.fn((values: unknown) => {
        call.setArgs.push(values);

        return {
          where: vi.fn((condition: unknown) => {
            call.whereArgs.push(condition);

            return {
              returning: vi.fn((args?: unknown) => {
                call.returningArgs.push(args);
                const result = updateResults[updateResultIndex] ?? [];
                updateResultIndex += 1;
                return Promise.resolve(result);
              }),
            };
          }),
        };
      }),
    };
  };

  const tx = {
    insert: vi.fn(makeInsert(txInsertCalls)),
    select: vi.fn(() => txSelectBuilder),
  };

  const db = {
    insert: vi.fn(makeInsert(insertCalls)),
    update: vi.fn(makeUpdate()),
    select: vi.fn(() => topLevelSelectBuilder),
    transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };

  return {
    db,
    insertCalls,
    selectBuilder: topLevelSelectBuilder,
    selectWhereArgs,
    tx,
    txInsertCalls,
    txSelectBuilder,
    txSelectWhereArgs,
    updateCalls,
  };
}

describe('NotificationsRepository', () => {
  it('upserts the full default preference matrix with whatsapp disabled for every event', async () => {
    const { db, insertCalls } = createDbMock();
    const repository = new NotificationsRepository({ db } as never);

    await repository.ensureDefaultPreferences('82bf0afe-b730-4046-ac0b-30f74ce1db7a');

    expect(insertCalls[0]?.table).toBe(notificationPreferences);

    const values = insertCalls[0]?.valuesArgs[0];
    expect(Array.isArray(values)).toBe(true);
    expect(values).toHaveLength(notificationEventTypes.length * notificationChannels.length);

    const pairs = new Set(
      (values as { eventType: string; channel: string; enabled: boolean }[]).map(
        (row) => `${row.eventType}:${row.channel}:${row.enabled ? 'true' : 'false'}`,
      ),
    );
    const expectedPairs = new Set(
      notificationEventTypes.flatMap((eventType) =>
        notificationChannels.map((channel) => {
          const enabled = channel === 'whatsapp' ? false : true;
          return `${eventType}:${channel}:${enabled ? 'true' : 'false'}`;
        }),
      ),
    );

    expect(pairs).toEqual(expectedPairs);
  });

  it('replaces preferences inside one transaction and returns the workspace preference list', async () => {
    const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
    const { db, insertCalls, selectWhereArgs, txInsertCalls, txSelectWhereArgs } = createDbMock({
      selectResults: [[{ id: 'preference-row' }]],
    });
    const repository = new NotificationsRepository({ db } as never);

    const rows = await repository.replacePreferences({
      workspaceId,
      preferences: [
        { eventType: 'draw.approved', channel: 'email', enabled: false },
        { eventType: 'snag.opened', channel: 'in_app', enabled: true },
      ],
    });

    expect(rows).toEqual([{ id: 'preference-row' }]);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(insertCalls).toHaveLength(0);
    expect(txInsertCalls).toHaveLength(2);
    expect(txInsertCalls[0]?.table).toBe(notificationPreferences);
    expect(txInsertCalls[1]?.valuesArgs[0]).toEqual([
      expect.objectContaining({
        workspaceId,
        eventType: 'draw.approved',
        channel: 'email',
        enabled: false,
      }),
      expect.objectContaining({
        workspaceId,
        eventType: 'snag.opened',
        channel: 'in_app',
        enabled: true,
      }),
    ]);
    expect(collectLeaves(txInsertCalls[1]?.onConflictArgs[0])).toEqual(
      expect.arrayContaining(['excluded.enabled']),
    );
    expect(selectWhereArgs).toHaveLength(0);
    expect(collectLeaves(txSelectWhereArgs[0])).toEqual(
      expect.arrayContaining(['workspace_id', workspaceId]),
    );
  });

  it('lists workspace preferences after seeding defaults', async () => {
    const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
    const { db, insertCalls, selectBuilder, selectWhereArgs } = createDbMock({
      selectResults: [[{ id: 'pref-1' }], [{ id: 'pref-1' }, { id: 'pref-2' }]],
    });
    const repository = new NotificationsRepository({ db } as never);

    const rows = await repository.listPreferences(workspaceId);

    expect(rows).toEqual([{ id: 'pref-1' }, { id: 'pref-2' }]);
    expect(insertCalls[0]?.table).toBe(notificationPreferences);
    expect(selectBuilder.from).toHaveBeenCalledWith(notificationPreferences);
    expect(collectLeaves(selectWhereArgs[0])).toEqual(
      expect.arrayContaining(['workspace_id', workspaceId]),
    );
  });

  it('lists complete workspace preferences without seeding defaults', async () => {
    const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
    const completePreferences = notificationEventTypes.flatMap((eventType) =>
      notificationChannels.map((channel) => ({
        id: `${eventType}-${channel}`,
        workspaceId,
        eventType,
        channel,
        enabled: channel !== 'whatsapp',
      })),
    );
    const { db, insertCalls } = createDbMock({
      selectResults: [completePreferences],
    });
    const repository = new NotificationsRepository({ db } as never);

    const rows = await repository.listPreferences(workspaceId);

    expect(rows).toEqual(completePreferences);
    expect(insertCalls).toHaveLength(0);
  });

  it('returns recipient ids without active workspace membership', async () => {
    const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
    const activeUserId = '3f43835d-7f3b-4b16-907b-d57db49832dd';
    const missingUserId = '708d71fe-8bc4-4027-bfb5-cfe41c033eb2';
    const { db, selectBuilder, selectWhereArgs } = createDbMock({
      selectResults: [[{ userId: activeUserId }]],
    });
    const repository = new NotificationsRepository({ db } as never);

    const missingIds = await repository.findMissingActiveRecipientIds(workspaceId, [
      activeUserId,
      missingUserId,
      activeUserId,
    ]);

    expect(missingIds).toEqual([missingUserId]);
    expect(selectBuilder.from).toHaveBeenCalledWith(workspaceMembershipRefs);
    expect(collectLeaves(selectWhereArgs[0])).toEqual(
      expect.arrayContaining([
        'workspace_id',
        workspaceId,
        'user_id',
        activeUserId,
        missingUserId,
        'is_active',
        'true',
        'deleted_at',
      ]),
    );
  });

  it('inserts in-app notification rows', async () => {
    const { db, insertCalls } = createDbMock();
    const repository = new NotificationsRepository({ db } as never);

    await repository.createNotification({
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      recipientUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      eventType: 'snag.opened',
      title: 'Snag opened',
      body: 'Kitchen snag opened',
      resourceType: 'snag',
      resourceId: 'snag-1',
      payload: {},
    });

    expect(insertCalls[0]?.table).toBe(notifications);
    expect(insertCalls[0]?.valuesArgs[0]).toMatchObject({
      eventType: 'snag.opened',
      recipientUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
    });
  });

  it('inserts in-app notifications and delivery attempts inside one transaction', async () => {
    const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
    const recipientUserId = '3f43835d-7f3b-4b16-907b-d57db49832dd';
    const attemptedAt = new Date('2026-07-01T12:00:00.000Z');
    const { db, insertCalls, txInsertCalls } = createDbMock({
      insertReturningFactory: (table, values) => {
        if (table === notifications) {
          return [
            {
              ...(values as Record<string, unknown>),
              id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
              readAt: null,
              createdAt: attemptedAt,
            },
          ];
        }

        if (table === notificationDeliveries && Array.isArray(values)) {
          return values.map((value, index) => ({
            ...(value as Record<string, unknown>),
            id: `delivery-${String(index + 1)}`,
            createdAt: attemptedAt,
          }));
        }

        return undefined;
      },
    });
    const repository = new NotificationsRepository({ db } as never);

    const result = await repository.createNotificationRoutes({
      notifications: [
        {
          notification: {
            workspaceId,
            recipientUserId,
            eventType: 'draw.approved',
            title: 'Draw approved',
            body: 'Client approved draw D-104',
            resourceType: 'draw',
            resourceId: 'draw-104',
            payload: {},
          },
          delivery: {
            workspaceId,
            recipientUserId,
            eventType: 'draw.approved',
            channel: 'in_app',
            status: 'sent',
            recipientAddress: null,
            providerMessageId: null,
            skippedReason: null,
            errorMessage: null,
            attemptedAt,
          },
        },
      ],
      deliveries: [
        {
          workspaceId,
          notificationId: null,
          recipientUserId,
          eventType: 'draw.approved',
          channel: 'email',
          status: 'skipped',
          recipientAddress: 'pm@example.com',
          providerMessageId: null,
          skippedReason: 'email.provider_unconfigured',
          errorMessage: null,
          attemptedAt,
        },
      ],
    });

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(insertCalls).toHaveLength(0);
    expect(txInsertCalls.map((call) => call.table)).toEqual([
      notifications,
      notificationDeliveries,
      notificationDeliveries,
    ]);
    expect(result.notificationRoutes[0]?.delivery.notificationId).toBe(
      '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
    );
    expect(result.deliveries).toHaveLength(2);
  });

  it('inserts append-only delivery rows', async () => {
    const { db, insertCalls } = createDbMock();
    const repository = new NotificationsRepository({ db } as never);

    await repository.createDeliveries([
      {
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        notificationId: null,
        recipientUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        eventType: 'document.signed',
        channel: 'email',
        status: 'skipped',
        recipientAddress: 'pm@example.com',
        providerMessageId: null,
        skippedReason: 'email.provider_unconfigured',
        errorMessage: null,
        attemptedAt: new Date('2026-07-01T12:00:00.000Z'),
      },
    ]);

    expect(insertCalls[0]?.table).toBe(notificationDeliveries);
    expect(insertCalls[0]?.valuesArgs[0]).toEqual([
      expect.objectContaining({ channel: 'email', status: 'skipped' }),
    ]);
  });

  it('lists notifications with workspace, recipient, unread, and cursor scoping', async () => {
    const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
    const recipientUserId = '3f43835d-7f3b-4b16-907b-d57db49832dd';
    const before = new Date('2026-07-01T12:00:00.000Z');
    const { db, selectBuilder, selectWhereArgs } = createDbMock({
      selectResults: [[{ id: 'notification-row' }]],
    });
    const repository = new NotificationsRepository({ db } as never);

    const rows = await repository.listNotifications({
      workspaceId,
      recipientUserId,
      unreadOnly: true,
      before,
      beforeId: 'notification-2',
      limit: 20,
    });

    expect(rows).toEqual([{ id: 'notification-row' }]);
    expect(selectBuilder.from).toHaveBeenCalledWith(notifications);
    expect(selectBuilder.limit).toHaveBeenCalledWith(20);
    expect(selectBuilder.orderBy).toHaveBeenCalledTimes(1);
    expect(collectLeaves(selectWhereArgs[0])).toEqual(
      expect.arrayContaining([
        'workspace_id',
        workspaceId,
        'recipient_user_id',
        recipientUserId,
        'read_at',
        before.toISOString(),
        'notification-2',
      ]),
    );
  });

  it('counts unread notifications within workspace and recipient scope', async () => {
    const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
    const recipientUserId = '3f43835d-7f3b-4b16-907b-d57db49832dd';
    const { db, selectWhereArgs } = createDbMock({
      selectResults: [[{ value: 4 }]],
    });
    const repository = new NotificationsRepository({ db } as never);

    const unreadCount = await repository.countUnread({ workspaceId, recipientUserId });

    expect(unreadCount).toBe(4);
    expect(collectLeaves(selectWhereArgs[0])).toEqual(
      expect.arrayContaining(['workspace_id', workspaceId, 'recipient_user_id', recipientUserId]),
    );
  });

  it('marks one notification as read within workspace and recipient scope', async () => {
    const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
    const recipientUserId = '3f43835d-7f3b-4b16-907b-d57db49832dd';
    const readAt = new Date('2026-07-01T13:00:00.000Z');
    const { db, updateCalls } = createDbMock({
      updateResults: [[{ id: 'notification-1', readAt }]],
    });
    const repository = new NotificationsRepository({ db } as never);

    const row = await repository.markRead({
      workspaceId,
      recipientUserId,
      notificationId: 'notification-1',
      readAt,
    });

    expect(row).toEqual({ id: 'notification-1', readAt });
    expect(updateCalls[0]?.table).toBe(notifications);
    expect(updateCalls[0]?.setArgs[0]).toEqual({ readAt: expect.anything() });
    expect(collectLeaves(updateCalls[0]?.whereArgs[0])).toEqual(
      expect.arrayContaining([
        'workspace_id',
        workspaceId,
        'recipient_user_id',
        recipientUserId,
        'id',
        'notification-1',
      ]),
    );
  });

  it('marks all unread notifications as read within workspace and recipient scope', async () => {
    const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
    const recipientUserId = '3f43835d-7f3b-4b16-907b-d57db49832dd';
    const readAt = new Date('2026-07-01T13:00:00.000Z');
    const { db, updateCalls } = createDbMock({
      updateResults: [[{ id: 'notification-1' }, { id: 'notification-2' }]],
    });
    const repository = new NotificationsRepository({ db } as never);

    const updatedCount = await repository.markAllRead({
      workspaceId,
      recipientUserId,
      readAt,
    });

    expect(updatedCount).toBe(2);
    expect(updateCalls[0]?.table).toBe(notifications);
    expect(updateCalls[0]?.setArgs[0]).toEqual({ readAt });
    expect(updateCalls[0]?.returningArgs[0]).toEqual({ id: notifications.id });
    expect(collectLeaves(updateCalls[0]?.whereArgs[0])).toEqual(
      expect.arrayContaining(['workspace_id', workspaceId, 'recipient_user_id', recipientUserId]),
    );
  });

  it('does not expose notification delete methods', () => {
    const { db } = createDbMock();
    const repository = new NotificationsRepository({ db } as never) as unknown as Record<
      string,
      unknown
    >;

    expect(repository.deleteNotification).toBeUndefined();
    expect(repository.deleteDelivery).toBeUndefined();
  });
});
