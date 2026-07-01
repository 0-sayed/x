// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, createApiClient } from './api/client.js';
import { useApiClient } from './api/hooks.js';
import { App } from './App.js';
import { i18n } from './i18n/i18n.js';
import { AppProviders } from './providers/AppProviders.js';
import { useConfirm } from './ui/confirm.js';
import { useToast } from './ui/toast.js';

const sessionUser = {
  id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
  email: 'admin@example.com',
  displayName: 'Admin User',
  phone: null,
  avatarUrl: null,
  activeWorkspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
  workspaces: [
    {
      id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      roleKey: 'workspace_admin',
      permissions: ['workspace.view', 'projects.view', 'people.view', 'settings.view'],
      isAdmin: true,
    },
    {
      id: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
      name: 'Second Workspace',
      slug: 'second-workspace',
      roleKey: 'member',
      permissions: ['workspace.view'],
      isAdmin: false,
    },
  ],
};

const workspaceContext = {
  workspace: {
    id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
    name: 'Demo Workspace',
    slug: 'demo-workspace',
    paymentCurrency: 'SAR',
  },
  membership: {
    userId: sessionUser.id,
    roleKey: 'workspace_admin',
    permissions: ['workspace.view', 'projects.view', 'people.view', 'settings.view'],
    isAdmin: true,
  },
  access: {
    appInstalled: true,
    subscriptionActive: true,
    membershipActive: true,
  },
};

function createAuthenticatedFetchMock({
  logoutStatus = 204,
  switcherActiveWorkspaceId = sessionUser.activeWorkspaceId,
  workspaceContextResponse = workspaceContext,
}: {
  readonly logoutStatus?: number;
  readonly switcherActiveWorkspaceId?: string | null;
  readonly workspaceContextResponse?: typeof workspaceContext | Promise<Response>;
} = {}) {
  let loggedOut = false;

  return vi.fn((input: RequestInfo | URL, init?: RequestInit): Response | Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (url.endsWith('/user')) {
      if (loggedOut) {
        return new Response('', { status: 401 });
      }

      return Response.json(sessionUser);
    }

    if (url.endsWith('/workspaces') && init?.method !== 'POST') {
      return Response.json({
        activeWorkspaceId: switcherActiveWorkspaceId,
        workspaces: sessionUser.workspaces,
      });
    }

    if (url.endsWith('/workspace-context')) {
      if (workspaceContextResponse instanceof Promise) {
        return workspaceContextResponse;
      }

      return Response.json(workspaceContextResponse);
    }

    if (url.endsWith('/workspaces/active')) {
      return Response.json({
        activeWorkspaceId: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
        workspaces: sessionUser.workspaces,
      });
    }

    if (url.endsWith('/auth/logout')) {
      if (logoutStatus === 204) {
        loggedOut = true;
      }

      return new Response(null, { status: logoutStatus });
    }

    return new Response('', { status: 404 });
  });
}

beforeEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('en');
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  document.body.dir = 'ltr';
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

describe('ApiClient', () => {
  it('returns null for unauthenticated current user requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    const client = createApiClient('http://127.0.0.1:3000/', fetchMock);

    await expect(client.getCurrentUser()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3000/user', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      method: 'GET',
    });
  });

  it('rejects malformed current user payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: 'not-a-uuid',
        accessToken: 'must-not-be-accepted',
      }),
    );
    const client = createApiClient('http://127.0.0.1:3000', fetchMock);

    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(ApiError);
  });

  it('wraps non-json successful responses in ApiError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    const client = createApiClient('http://127.0.0.1:3000', fetchMock);

    await expect(client.getCurrentUser()).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
    });
  });
});

describe('AppProviders', () => {
  it('keeps the default API client stable across rerenders', () => {
    const clients: unknown[] = [];

    function CaptureClient() {
      const [count, setCount] = useState(0);
      clients.push(useApiClient());

      return (
        <button
          type="button"
          onClick={() => {
            setCount((current) => current + 1);
          }}
        >
          rerender {count}
        </button>
      );
    }

    function RerenderProvider() {
      const [count, setCount] = useState(0);

      return (
        <AppProviders>
          <CaptureClient />
          <button
            type="button"
            onClick={() => {
              setCount((current) => current + 1);
            }}
          >
            rerender provider {count}
          </button>
        </AppProviders>
      );
    }

    render(<RerenderProvider />);

    fireEvent.click(screen.getByRole('button', { name: /rerender provider/i }));

    expect(clients.length).toBeGreaterThanOrEqual(2);
    expect(clients[1]).toBe(clients[0]);
  });
});

describe('ToastProvider', () => {
  it('keeps newer toasts visible for their own timeout window', () => {
    vi.useFakeTimers();
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    function TriggerToasts() {
      const toast = useToast();

      return (
        <button
          type="button"
          onClick={() => {
            toast.showToast('First');
            window.setTimeout(() => {
              toast.showToast('Second');
            }, 1_000);
          }}
        >
          show toasts
        </button>
      );
    }

    render(
      <AppProviders>
        <TriggerToasts />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'show toasts' }));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText('First')).toBeVisible();
    expect(screen.getByText('Second')).toBeVisible();

    act(() => {
      vi.advanceTimersByTime(1_800);
    });

    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('Second')).toBeVisible();
  });

  it('clears pending toast timers on unmount', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

    function TriggerToast() {
      const toast = useToast();

      return (
        <button
          type="button"
          onClick={() => {
            toast.showToast('Queued');
          }}
        >
          show toast
        </button>
      );
    }

    const { unmount } = render(
      <AppProviders>
        <TriggerToast />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'show toast' }));
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

describe('ConfirmProvider', () => {
  it('keeps concurrent confirm calls resolvable', async () => {
    const resolutions: boolean[] = [];

    function TriggerConfirms() {
      const confirmDialog = useConfirm();

      return (
        <button
          type="button"
          onClick={() => {
            void confirmDialog
              .confirm({ title: 'First?', message: 'First message' })
              .then((value) => {
                resolutions.push(value);
              });
            void confirmDialog
              .confirm({ title: 'Second?', message: 'Second message' })
              .then((value) => {
                resolutions.push(value);
              });
          }}
        >
          confirm twice
        </button>
      );
    }

    render(
      <AppProviders>
        <TriggerConfirms />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'confirm twice' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(resolutions).toEqual([false, true]);
    });
  });

  it('cycles focus inside the confirm dialog', async () => {
    function TriggerConfirm() {
      const confirmDialog = useConfirm();

      return (
        <>
          <button type="button">outside</button>
          <button
            type="button"
            onClick={() => void confirmDialog.confirm({ title: 'Confirm?', message: 'Message' })}
          >
            open
          </button>
        </>
      );
    }

    render(
      <AppProviders>
        <TriggerConfirm />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm?' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });

    expect(cancel).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(cancel).toHaveFocus();
  });
});

describe('App', () => {
  it('renders the unauthenticated login screen when /user returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));

    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: /materiabill/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /continue with inframodern/i })).toBeVisible();
  });

  it('renders authenticated global chrome and active workspace', async () => {
    vi.stubGlobal('fetch', createAuthenticatedFetchMock());

    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Workspace home' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    await waitFor(() => {
      expect(screen.getByLabelText('Workspace')).toHaveValue(
        '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      );
    });
    expect(screen.getByText('Admin User')).toBeVisible();
  });

  it('switches workspace through the backend switch endpoint', async () => {
    const fetchMock = createAuthenticatedFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await screen.findByRole('heading', { level: 1, name: 'Workspace home' });
    await waitFor(() => {
      expect(screen.getByLabelText('Workspace')).toHaveValue(
        '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      );
    });
    fireEvent.change(screen.getByLabelText('Workspace'), {
      target: { value: '219cc5f7-6bf0-40fe-87c8-c550ee501af6' },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3000/workspaces/active', {
        body: JSON.stringify({ workspaceId: '219cc5f7-6bf0-40fe-87c8-c550ee501af6' }),
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        method: 'POST',
      });
    });
  });

  it('selects the first workspace while the backend active workspace is null', async () => {
    vi.stubGlobal(
      'fetch',
      createAuthenticatedFetchMock({
        switcherActiveWorkspaceId: null,
      }),
    );

    render(<App />);

    await screen.findByRole('heading', { level: 1, name: 'Workspace home' });
    await waitFor(() => {
      expect(screen.getByLabelText('Workspace')).toHaveValue(
        '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      );
    });
  });

  it('confirms logout before clearing the session', async () => {
    const fetchMock = createAuthenticatedFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await screen.findByRole('heading', { level: 1, name: 'Workspace home' });
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(screen.getByRole('dialog', { name: 'Sign out?' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3000/auth/logout', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        method: 'POST',
      });
    });
    expect(await screen.findByText('Signed out.')).toBeVisible();
    expect(await screen.findByRole('button', { name: /continue with inframodern/i })).toBeVisible();
  });

  it('surfaces logout failures without clearing the session', async () => {
    vi.stubGlobal('fetch', createAuthenticatedFetchMock({ logoutStatus: 500 }));

    render(<App />);

    await screen.findByRole('heading', { level: 1, name: 'Workspace home' });
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Sign out failed.')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Workspace home' })).toBeVisible();
  });

  it('holds route content until workspace context has loaded', async () => {
    let resolveWorkspaceContext!: (response: Response) => void;
    const pendingWorkspaceContext = new Promise<Response>((resolve) => {
      resolveWorkspaceContext = resolve;
    });

    vi.stubGlobal(
      'fetch',
      createAuthenticatedFetchMock({
        workspaceContextResponse: pendingWorkspaceContext,
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Loading workspace...')).toBeVisible();
    });
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Workspace home' }),
    ).not.toBeInTheDocument();

    resolveWorkspaceContext(Response.json(workspaceContext));

    expect(await screen.findByRole('heading', { level: 1, name: 'Workspace home' })).toBeVisible();
  });

  it('blocks directly addressed routes without the required permission', async () => {
    window.history.pushState({}, '', '/settings');
    vi.stubGlobal(
      'fetch',
      createAuthenticatedFetchMock({
        workspaceContextResponse: {
          ...workspaceContext,
          membership: {
            ...workspaceContext.membership,
            permissions: ['workspace.view'],
          },
        },
      }),
    );

    render(<App />);

    expect(await screen.findByText('You do not have access to this section.')).toBeVisible();
    expect(screen.queryByRole('heading', { level: 1, name: 'Settings' })).not.toBeInTheDocument();
  });

  it('switches the document to Arabic RTL when Arabic is selected', async () => {
    vi.stubGlobal('fetch', createAuthenticatedFetchMock());

    render(<App />);

    await screen.findByRole('heading', { level: 1, name: 'Workspace home' });
    fireEvent.click(screen.getByRole('button', { name: 'العربية' }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', 'ar');
      expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    });
    expect(screen.getByRole('button', { name: 'English' })).toBeVisible();
  });

  it('uses accurate Arabic sign-out copy', async () => {
    vi.stubGlobal('fetch', createAuthenticatedFetchMock());

    render(<App />);

    await screen.findByRole('heading', { level: 1, name: 'Workspace home' });
    fireEvent.click(screen.getByRole('button', { name: 'العربية' }));
    fireEvent.click(await screen.findByRole('button', { name: 'تسجيل الخروج' }));

    expect(await screen.findByText('سيتم حذف ملف تعريف ارتباط الجلسة على الخادم.')).toBeVisible();
  });
});
