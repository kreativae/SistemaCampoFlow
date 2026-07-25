'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Leaf, MapPinned, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import type { Farm } from '@/lib/types';

export default function FarmsPage() {
  const { user, accessToken, loading, logout } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFarmName, setNewFarmName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadFarms = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Farm[]>('/fazendas', { token: accessToken });
      setFarms(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar propriedades');
    } finally {
      setFetching(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // Fetching data on mount via an async callback is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFarms();
  }, [loading, user, loadFarms, router]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch<Farm>('/fazendas', {
        method: 'POST',
        token: accessToken,
        body: { name: newFarmName },
      });
      setNewFarmName('');
      await loadFarms();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar propriedade');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(farm: Farm) {
    setEditingId(farm.id);
    setEditName(farm.name);
  }

  async function handleSaveEdit(farmId: string) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}`, {
        method: 'PATCH',
        token: accessToken,
        body: { name: editName },
      });
      setEditingId(null);
      await loadFarms();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar propriedade');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(farm: Farm) {
    const confirmed = await confirm({
      title: 'Excluir propriedade',
      message:
        `ATENÇÃO: excluir a propriedade "${farm.name}" é IRREVERSÍVEL.\n\n` +
        'Todos os dados vinculados a ela serão apagados permanentemente — animais, pastagens, ' +
        'máquinas, insumos, financeiro, clima, agenda, mapa, documentos e demais registros.\n\n' +
        'Não será possível recuperar esses dados depois.',
      confirmLabel: 'Excluir definitivamente',
      danger: true,
      requireText: farm.name,
      requireTextLabel: `Para confirmar, digite o nome exato da propriedade ("${farm.name}")`,
    });
    if (!confirmed) return;

    setDeletingId(farm.id);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farm.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadFarms();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir propriedade');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600">
            <Leaf size={20} strokeWidth={2} className="text-white" />
          </span>
          <div>
            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-gray-900">CampoFlow</h1>
            <p className="text-sm text-gray-500">Olá, {user.name}</p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 sm:w-auto sm:gap-4">
          <Link
            href="/conta/perfil"
            className="text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-900"
          >
            Meu perfil
          </Link>
          <Link
            href="/conta/assinatura"
            className="text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-900"
          >
            Assinatura
          </Link>
          <Link
            href="/seguranca"
            className="text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-900"
          >
            Segurança
          </Link>
          <Link
            href="/suporte"
            className="text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-900"
          >
            Suporte
          </Link>
          {user.isPlatformAdmin && (
            <Link
              href="/admin"
              className="text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-900"
            >
              Admin
            </Link>
          )}
          <button
            onClick={logout}
            className="text-sm font-semibold text-gray-500 transition-colors hover:text-gray-900"
          >
            Sair
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="mb-8 flex gap-2">
        <input
          type="text"
          placeholder="Nome da nova propriedade"
          required
          value={newFarmName}
          onChange={(e) => setNewFarmName(e.target.value)}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          type="submit"
          disabled={creating}
          className="flex items-center gap-1.5 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
        >
          <Plus size={16} strokeWidth={2.2} />
          {creating ? 'Criando...' : 'Criar'}
        </button>
      </form>

      {fetching ? (
        <p className="text-sm text-gray-400">Carregando propriedades...</p>
      ) : farms.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-gray-100/60 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
            <MapPinned size={22} strokeWidth={1.9} />
          </span>
          <p className="mt-4 text-lg font-bold text-gray-900">Bem-vindo ao CampoFlow!</p>
          <p className="mt-1 text-sm text-gray-500">
            Cadastre sua primeira propriedade para começar a gerenciar o rebanho, pastagens e
            finanças.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {farms.map((farm) =>
            editingId === farm.id ? (
              <li
                key={farm.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-600 bg-white px-4 py-3"
              >
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveEdit(farm.id)}
                  className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-full bg-gray-900/5 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
                >
                  Cancelar
                </button>
              </li>
            ) : (
              <li
                key={farm.id}
                className="group flex flex-wrap items-center justify-between gap-y-2 rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_10px_30px_-12px_rgba(6,30,20,0.15)]"
              >
                <Link href={`/fazendas/${farm.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 transition-colors duration-200 group-hover:bg-emerald-600/20">
                    <MapPinned size={18} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 font-semibold text-gray-900">{farm.name}</span>
                    <span className="block text-sm text-gray-500">{farm.type}</span>
                  </span>
                </Link>
                <div className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => startEdit(farm)}
                    className="text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-900"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === farm.id}
                    onClick={() => handleDelete(farm)}
                    className="text-sm font-semibold text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
                  >
                    {deletingId === farm.id ? 'Excluindo...' : 'Excluir'}
                  </button>
                  <ChevronRight
                    size={16}
                    className="text-gray-300 transition-colors duration-200 group-hover:text-emerald-500"
                  />
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </main>
  );
}
