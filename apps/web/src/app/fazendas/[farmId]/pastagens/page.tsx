'use client';

import { Leaf, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import NewRecordButton from '@/components/NewRecordButton';
import FormModal from '@/components/FormModal';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import { useToast } from '@/lib/toast-context';
import type { Pasture } from '@/lib/types';

export default function PasturesPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const { toastSuccess } = useToast();

  const [pastures, setPastures] = useState<Pasture[]>([]);
  // No mobile o formulário começa fechado para não empurrar a lista.
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [areaHectares, setAreaHectares] = useState('');
  const [grassType, setGrassType] = useState('');
  const [animalCapacity, setAnimalCapacity] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAreaHectares, setEditAreaHectares] = useState('');
  const [editGrassType, setEditGrassType] = useState('');
  const [editAnimalCapacity, setEditAnimalCapacity] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Pasture[]>(`/fazendas/${farmId}/pastagens`, { token: accessToken });
      setPastures(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar pastagens');
    } finally {
      setFetching(false);
    }
  }, [farmId, accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // Fetching data on mount via an async callback is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loading, user, loadData, router]);

  // Fecha a visualização rápida ao pressionar Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setEditingId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch<Pasture>(`/fazendas/${farmId}/pastagens`, {
        method: 'POST',
        token: accessToken,
        body: {
          name,
          areaHectares: Number(areaHectares),
          grassType: grassType || undefined,
          animalCapacity: Number(animalCapacity),
        },
      });
      setName('');
      setAreaHectares('');
      setGrassType('');
      setAnimalCapacity('');
      setCreatingOpen(false);
      await loadData();
      toastSuccess('Pasto cadastrado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar pasto');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(pasture: Pasture) {
    setEditingId(pasture.id);
    setEditName(pasture.name);
    setEditAreaHectares(String(pasture.areaHectares));
    setEditGrassType(pasture.grassType ?? '');
    setEditAnimalCapacity(String(pasture.animalCapacity));
  }

  async function handleSaveEdit(pastureId: string) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/pastagens/${pastureId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          name: editName,
          areaHectares: Number(editAreaHectares),
          grassType: editGrassType || undefined,
          animalCapacity: Number(editAnimalCapacity),
        },
      });
      setEditingId(null);
      await loadData();
      toastSuccess('Pasto atualizado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar pasto');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pasture: Pasture) {
    const ok = await confirm({
      title: 'Excluir pasto',
      message: `Excluir o pasto ${pasture.name}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/pastagens/${pasture.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
      toastSuccess('Pasto excluído.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir pasto');
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
    <main className="animate-fade-up mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
      <PageHeader
        icon={Leaf}
        title="Pastagens"
        subtitle="Pastos, áreas e capacidade"
        backHref={`/fazendas/${farmId}`}
        actions={<NewRecordButton label="Nova pastagem" onClick={() => setCreatingOpen(true)} />}
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {creatingOpen && (
        <FormModal
          icon={Leaf}
          title="Nova pastagem"
          subtitle="Cadastre um pasto da propriedade"
          onClose={() => setCreatingOpen(false)}
        >
      <form
        onSubmit={handleCreate}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700">Nome</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Área (ha)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={areaHectares}
            onChange={(e) => setAreaHectares(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Capacidade (animais)</label>
          <input
            type="number"
            min="1"
            required
            value={animalCapacity}
            onChange={(e) => setAnimalCapacity(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div className="col-span-2 sm:col-span-3">
          <label className="text-sm font-medium text-gray-700">Tipo de capim</label>
          <input
            type="text"
            value={grassType}
            onChange={(e) => setGrassType(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div className="col-span-full flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setCreatingOpen(false)}
            className="rounded-full bg-gray-900/5 px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={creating}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
          >
            {creating ? 'Cadastrando...' : 'Cadastrar pasto'}
          </button>
        </div>
      </form>
        </FormModal>
      )}

      {fetching ? (
        <p className="text-sm text-gray-400">Carregando pastos...</p>
      ) : pastures.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-gray-100/60 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
            <Leaf size={22} strokeWidth={1.9} />
          </span>
          <p className="mt-4 text-lg font-bold text-gray-900">Nenhum pasto cadastrado</p>
          <p className="mt-1 text-sm text-gray-500">Cadastre seu primeiro pasto para controlar a lotação e rotação do rebanho.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {pastures.map((pasture) => {
            const occupiedHeadCount = pasture.animalHeadCount ?? 0;
            return (
              <li
                key={pasture.id}
                className="flex flex-col gap-2 rounded-2xl border border-gray-200/70 bg-white px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_10px_30px_-12px_rgba(6,30,20,0.15)] sm:flex-row sm:items-center sm:justify-between"
              >
                <Link href={`/fazendas/${farmId}/pastagens/${pasture.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700"><Leaf size={18} strokeWidth={1.9} /></span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900">{pasture.name}</span>
                    <span className="block truncate text-sm text-gray-500">
                      {pasture.areaHectares} ha · {pasture.grassType ?? 'Capim não informado'}
                    </span>
                  </span>
                </Link>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <p className="text-sm text-gray-500">
                    {occupiedHeadCount}/{pasture.animalCapacity} animais
                  </p>
                  <button
                    type="button"
                    onClick={() => startEdit(pasture)}
                    className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(pasture)}
                    className="text-sm font-semibold text-red-600 hover:text-red-800"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editingId && (
        <Modal onClose={() => setEditingId(null)}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
                  <Leaf size={19} strokeWidth={1.9} />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-gray-900">{editName}</h2>
                  <p className="text-xs text-gray-500">Editar dados</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-full p-1.5 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 px-6 py-5">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">Nome</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Área (ha)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editAreaHectares}
                  onChange={(e) => setEditAreaHectares(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Capacidade</label>
                <input
                  type="number"
                  min="1"
                  value={editAnimalCapacity}
                  onChange={(e) => setEditAnimalCapacity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">Tipo de capim</label>
                <input
                  type="text"
                  value={editGrassType}
                  onChange={(e) => setEditGrassType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-6 py-4">
              <Link
                href={`/fazendas/${farmId}/pastagens/${editingId}`}
                className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              >
                Ver detalhes completos →
              </Link>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-full bg-gray-900/5 px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveEdit(editingId)}
                  className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
        </Modal>
      )}
    </main>
  );
}
