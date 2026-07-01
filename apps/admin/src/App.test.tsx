// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, createApiClient } from './api/client.js';
import { App } from './App.js';
import { i18n } from './i18n/i18n.js';

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

function createAuthenticatedFetchMock() {
  let loggedOut = false;

  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (url.endsWith('/user')) {
      if (loggedOut) {
        return new Response('', { status: 401 });
      }

      return Response.json(sessionUser);
    }

    if (url.endsWith('/workspaces') && init?.method !== 'POST') {
      return Response.json({
        activeWorkspaceId: sessionUser.activeWorkspaceId,
        workspaces: sessionUser.workspaces,
      });
    }

    if (url.endsWith('/workspace-context')) {
      return Response.json(workspaceContext);
    }

    if (url.endsWith('/workspaces/active')) {
      return Response.json({
        activeWorkspaceId: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
        workspaces: sessionUser.workspaces,
      });
    }

    if (url.endsWith('/auth/logout')) {
      loggedOut = true;
      return new Response(null, { status: 204 });
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
  vi.unstubAllGlobals();
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
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeVisible();
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
});
