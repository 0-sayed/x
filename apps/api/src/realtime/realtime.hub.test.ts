import { firstValueFrom, skip, take } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RealtimeHub } from './realtime.hub.js';

const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
const otherWorkspaceId = '2587f44b-8e61-4c6e-bc43-3f5a9bd6b8c3';

describe('RealtimeHub', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits a connected message when a workspace subscribes', async () => {
    const hub = new RealtimeHub();

    await expect(firstValueFrom(hub.subscribe(workspaceId))).resolves.toMatchObject({
      type: 'realtime.connected',
      retry: 10000,
      data: {
        workspaceId,
        type: 'realtime.connected',
        payload: {},
      },
    });
  });

  it('delivers published events only to the matching workspace', async () => {
    const hub = new RealtimeHub();
    const otherMessages: unknown[] = [];
    const otherSubscription = hub
      .subscribe(otherWorkspaceId)
      .pipe(skip(1))
      .subscribe((message) => {
        otherMessages.push(message);
      });
    const matchingMessages = firstValueFrom(hub.subscribe(workspaceId).pipe(skip(1), take(1)));

    const envelope = hub.publish({
      workspaceId,
      type: 'draws.settlement_bar.changed',
      payload: {
        drawId: '6fb54a70-0807-43b6-b5fe-6d446a673453',
      },
      id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      occurredAt: new Date('2026-07-01T12:00:00.000Z'),
    });

    await expect(matchingMessages).resolves.toEqual({
      id: envelope.id,
      type: 'draws.settlement_bar.changed',
      retry: 10000,
      data: envelope,
    });

    expect(otherMessages).toEqual([]);
    otherSubscription.unsubscribe();
  });

  it('returns a validated envelope when publishing without subscribers', () => {
    const hub = new RealtimeHub();

    expect(
      hub.publish({
        workspaceId,
        type: 'schedule.milestone.completed',
        payload: {
          milestoneId: '6fb54a70-0807-43b6-b5fe-6d446a673453',
        },
        id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
        occurredAt: new Date('2026-07-01T12:00:00.000Z'),
      }),
    ).toEqual({
      id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      workspaceId,
      type: 'schedule.milestone.completed',
      payload: {
        milestoneId: '6fb54a70-0807-43b6-b5fe-6d446a673453',
      },
      occurredAt: '2026-07-01T12:00:00.000Z',
    });
  });

  it('emits heartbeat messages while subscribed', async () => {
    vi.useFakeTimers();
    const hub = new RealtimeHub();
    const messagePromise = firstValueFrom(hub.subscribe(workspaceId).pipe(skip(1), take(1)));

    await vi.advanceTimersByTimeAsync(25_000);

    await expect(messagePromise).resolves.toMatchObject({
      type: 'realtime.heartbeat',
      retry: 10000,
      data: {
        workspaceId,
        type: 'realtime.heartbeat',
        payload: {},
      },
    });
  });

  it('removes unsubscribed observers from the workspace channel', () => {
    const hub = new RealtimeHub();
    const subscription = hub.subscribe(workspaceId).subscribe();

    expect(hub.getSubscriberCount(workspaceId)).toBe(1);
    expect(hub.getChannelCount()).toBe(1);
    subscription.unsubscribe();

    expect(hub.getSubscriberCount(workspaceId)).toBe(0);
    expect(hub.getChannelCount()).toBe(0);
  });
});
