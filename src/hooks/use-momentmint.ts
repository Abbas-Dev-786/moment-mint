import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

export const queryKeys = {
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  moments: ["moments"] as const,
  settings: ["settings"] as const,
  moment: (id: string) => ["moment", id] as const,
}

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: api.me, retry: false, staleTime: 30_000 })
}

export function useDashboard(active = true) {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard, enabled: active, staleTime: 2_000, refetchInterval: active ? 4_000 : false, refetchIntervalInBackground: false, retry: 1 })
}

export function useMoments(active = true) {
  return useQuery({ queryKey: queryKeys.moments, queryFn: () => api.moments(), enabled: active, staleTime: 2_000, refetchInterval: active ? 4_000 : false, refetchIntervalInBackground: false, retry: 1 })
}

export function useMoment(momentId: string | null) {
  return useQuery({ queryKey: queryKeys.moment(momentId ?? ""), queryFn: () => api.moment(momentId ?? ""), enabled: Boolean(momentId), staleTime: 2_000, refetchInterval: momentId ? 4_000 : false, refetchIntervalInBackground: false, retry: 1 })
}

export function useSettings(active = true) {
  return useQuery({ queryKey: queryKeys.settings, queryFn: api.settings, enabled: active, staleTime: 2_000, refetchInterval: active ? 5_000 : false, refetchIntervalInBackground: false, retry: 1 })
}

export function useInvalidateWorkspace() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.me }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.moments }),
      queryClient.invalidateQueries({ queryKey: ["moment"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
    ])
  }
}

export function useWorkspaceMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const invalidate = useInvalidateWorkspace()
  return useMutation({ mutationFn, onSuccess: async () => invalidate() })
}
