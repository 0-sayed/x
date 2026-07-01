import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import type {
  CurrentSessionUser,
  WorkspaceContext,
  WorkspaceSwitcherResponse,
} from '@materiabill/contracts';

import type { ApiClient, ApiError } from './client.js';

export const queryKeys = {
  currentUser: ['session', 'user'] as const,
  workspaceSwitcher: ['workspace', 'switcher'] as const,
  workspaceContext: ['workspace', 'context'] as const,
};

export const ApiClientContext = createContext<ApiClient | null>(null);

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) {
    throw new Error('ApiClientContext is missing.');
  }

  return client;
}

export function useCurrentUser(): UseQueryResult<CurrentSessionUser | null, ApiError> {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: () => client.getCurrentUser(),
    retry: false,
  });
}

export function useWorkspaceSwitcher(
  enabled: boolean,
): UseQueryResult<WorkspaceSwitcherResponse, ApiError> {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.workspaceSwitcher,
    queryFn: () => client.getWorkspaceSwitcher(),
    enabled,
    retry: false,
  });
}

export function useWorkspaceContext(enabled: boolean): UseQueryResult<WorkspaceContext, ApiError> {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.workspaceContext,
    queryFn: () => client.getWorkspaceContext(),
    enabled,
    retry: false,
  });
}

export function useSwitchWorkspace(): UseMutationResult<
  WorkspaceSwitcherResponse,
  ApiError,
  string
> {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId) => client.switchWorkspace(workspaceId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.currentUser }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaceSwitcher }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaceContext }),
      ]);
    },
  });
}

export function useLogout(): UseMutationResult<void, ApiError, void> {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => client.logout(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
