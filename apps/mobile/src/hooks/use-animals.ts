import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { Animal } from '../lib/types';

export function useAnimals(farmId: string) {
  return useQuery({
    queryKey: ['animals', farmId],
    queryFn: () => apiFetch<Animal[]>(`/fazendas/${farmId}/animais`),
    enabled: !!farmId,
  });
}

export function useAnimal(farmId: string, animalId: string) {
  return useQuery({
    queryKey: ['animal', farmId, animalId],
    queryFn: () => apiFetch<Animal>(`/fazendas/${farmId}/animais/${animalId}`),
    enabled: !!farmId && !!animalId,
  });
}

export function useCreateAnimal(farmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Animal>) => apiFetch<Animal>(`/fazendas/${farmId}/animais`, { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals', farmId] }),
  });
}

export function useUpdateAnimal(farmId: string, animalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Animal>) => apiFetch<Animal>(`/fazendas/${farmId}/animais/${animalId}`, { method: 'PATCH', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['animals', farmId] });
      qc.invalidateQueries({ queryKey: ['animal', farmId, animalId] });
    },
  });
}

export function useDeleteAnimal(farmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (animalId: string) => apiFetch(`/fazendas/${farmId}/animais/${animalId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['animals', farmId] }),
  });
}
