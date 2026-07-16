import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { Pasture } from '../lib/types';

export function usePastures(farmId: string) {
  return useQuery({
    queryKey: ['pastures', farmId],
    queryFn: () => apiFetch<Pasture[]>(`/farms/${farmId}/pastures`),
    enabled: !!farmId,
  });
}

export function usePasture(farmId: string, pastureId: string) {
  return useQuery({
    queryKey: ['pasture', farmId, pastureId],
    queryFn: () => apiFetch<Pasture>(`/farms/${farmId}/pastures/${pastureId}`),
    enabled: !!farmId && !!pastureId,
  });
}

export function useCreatePasture(farmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Pasture>) => apiFetch<Pasture>(`/farms/${farmId}/pastures`, { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pastures', farmId] }),
  });
}

export function useDeletePasture(farmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pastureId: string) => apiFetch(`/farms/${farmId}/pastures/${pastureId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pastures', farmId] }),
  });
}
