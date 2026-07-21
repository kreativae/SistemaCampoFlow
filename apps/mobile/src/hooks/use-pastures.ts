import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { Pasture } from '../lib/types';

export function usePastures(farmId: string) {
  return useQuery({
    queryKey: ['pastures', farmId],
    queryFn: () => apiFetch<Pasture[]>(`/fazendas/${farmId}/pastagens`),
    enabled: !!farmId,
  });
}

export function usePasture(farmId: string, pastureId: string) {
  return useQuery({
    queryKey: ['pasture', farmId, pastureId],
    queryFn: () => apiFetch<Pasture>(`/fazendas/${farmId}/pastagens/${pastureId}`),
    enabled: !!farmId && !!pastureId,
  });
}

export function useCreatePasture(farmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Pasture>) => apiFetch<Pasture>(`/fazendas/${farmId}/pastagens`, { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pastures', farmId] }),
  });
}

export function useUpdatePasture(farmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Pasture> & { id: string }) =>
      apiFetch<Pasture>(`/fazendas/${farmId}/pastagens/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pastures', farmId] }),
  });
}

export function useDeletePasture(farmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pastureId: string) => apiFetch(`/fazendas/${farmId}/pastagens/${pastureId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pastures', farmId] }),
  });
}
