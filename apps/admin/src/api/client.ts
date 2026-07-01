import {
  currentSessionUserSchema,
  workspaceContextSchema,
  workspaceSwitcherResponseSchema,
  type CurrentSessionUser,
  type WorkspaceContext,
  type WorkspaceSwitcherResponse,
} from '@materiabill/contracts';
import type { z } from 'zod';

type FetchLike = typeof fetch;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiClient = {
  readonly baseUrl: string;
  getCurrentUser(): Promise<CurrentSessionUser | null>;
  getWorkspaceSwitcher(): Promise<WorkspaceSwitcherResponse>;
  getWorkspaceContext(): Promise<WorkspaceContext>;
  switchWorkspace(workspaceId: string): Promise<WorkspaceSwitcherResponse>;
  logout(): Promise<void>;
  loginUrl(): string;
};

export function getDefaultApiBaseUrl(): string {
  const rawApiBaseUrl =
    typeof import.meta.env.VITE_API_BASE_URL === 'string'
      ? import.meta.env.VITE_API_BASE_URL
      : 'http://127.0.0.1:3000';

  return trimTrailingSlash(rawApiBaseUrl);
}

export function createApiClient(
  rawBaseUrl = getDefaultApiBaseUrl(),
  fetchImpl: FetchLike = fetch,
): ApiClient {
  const baseUrl = trimTrailingSlash(rawBaseUrl);

  return {
    baseUrl,
    getCurrentUser: () =>
      requestJson({
        baseUrl,
        fetchImpl,
        path: '/user',
        schema: currentSessionUserSchema,
        unauthenticatedAsNull: true,
      }),
    getWorkspaceSwitcher: () =>
      requestJson({
        baseUrl,
        fetchImpl,
        path: '/workspaces',
        schema: workspaceSwitcherResponseSchema,
      }),
    getWorkspaceContext: () =>
      requestJson({
        baseUrl,
        fetchImpl,
        path: '/workspace-context',
        schema: workspaceContextSchema,
      }),
    switchWorkspace: (workspaceId) =>
      requestJson({
        baseUrl,
        fetchImpl,
        path: '/workspaces/active',
        method: 'POST',
        body: { workspaceId },
        schema: workspaceSwitcherResponseSchema,
      }),
    logout: () =>
      requestNoContent({
        baseUrl,
        fetchImpl,
        path: '/auth/logout',
        method: 'POST',
      }),
    loginUrl: () => `${baseUrl}/auth/login`,
  };
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

type JsonRequestOptions<TSchema extends z.ZodType> = {
  readonly baseUrl: string;
  readonly fetchImpl: FetchLike;
  readonly path: string;
  readonly schema: TSchema;
  readonly method?: 'GET' | 'POST';
  readonly body?: unknown;
};

function requestJson<TSchema extends z.ZodType>(
  options: JsonRequestOptions<TSchema> & { readonly unauthenticatedAsNull: true },
): Promise<z.infer<TSchema> | null>;
function requestJson<TSchema extends z.ZodType>(
  options: JsonRequestOptions<TSchema> & { readonly unauthenticatedAsNull?: false },
): Promise<z.infer<TSchema>>;
async function requestJson<TSchema extends z.ZodType>({
  baseUrl,
  fetchImpl,
  path,
  schema,
  method = 'GET',
  body,
  unauthenticatedAsNull = false,
}: JsonRequestOptions<TSchema> & {
  readonly unauthenticatedAsNull?: boolean;
}): Promise<z.infer<TSchema> | null> {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    credentials: 'include',
    headers: body
      ? { Accept: 'application/json', 'Content-Type': 'application/json' }
      : { Accept: 'application/json' },
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && unauthenticatedAsNull) {
    return null;
  }

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ApiError('API response did not match the expected contract', response.status);
  }

  return parsed.data;
}

async function requestNoContent({
  baseUrl,
  fetchImpl,
  path,
  method,
}: {
  readonly baseUrl: string;
  readonly fetchImpl: FetchLike;
  readonly path: string;
  readonly method: 'POST';
}): Promise<void> {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    method,
  });

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }
}
