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
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard, enabled: active, staleTime: 4_000, refetchInterval: active ? 5_000 : false, refetchIntervalInBackground: false, retry: 1 })
}

export function useMoments(active = true) {
  return useQuery({ queryKey: queryKeys.moments, queryFn: () => api.moments(), enabled: active, staleTime: 4_000, refetchInterval: active ? 5_000 : false, refetchIntervalInBackground: false, retry: 1 })
}

export function useMoment(momentId: string | null) {
  return useQuery({ queryKey: queryKeys.moment(momentId ?? ""), queryFn: () => api.moment(momentId ?? ""), enabled: Boolean(momentId), retry: 1 })
}

export function useSettings(active = true) {
  return useQuery({ queryKey: queryKeys.settings, queryFn: api.settings, enabled: active, retry: false })
}

export function useInvalidateWorkspace() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.me })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
    void queryClient.invalidateQueries({ queryKey: queryKeys.moments })
    void queryClient.invalidateQueries({ queryKey: ["moment"] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.settings })
  }
}

export function useWorkspaceMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const invalidate = useInvalidateWorkspace()
  return useMutation({ mutationFn, onSuccess: invalidate })
}
