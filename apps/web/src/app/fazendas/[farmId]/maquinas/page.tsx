'use client';

import { Tractor } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import NewRecordButton from '@/components/NewRecordButton';
import FormModal from '@/components/FormModal';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useConfirm } from '@/lib/confirm-context';
import type { Machine, MachineCostSummary, MachineType } from '@/lib/types';

const TYPE_OPTIONS: { value: MachineType; label: string }[] = [
  { value: 'TRATOR', label: 'Trator' },
  { value: 'CAMINHAO', label: 'Caminhão' },
  { value: 'IMPLEMENTO', label: 'Implemento' },
  { value: 'OUTRO', label: 'Outro' },
];

function typeLabel(type: MachineType) {
  return TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function MachinesPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const { toastSuccess } = useToast();
  const router = useRouter();
  const confirm = useConfirm();

  const [machines, setMachines] = useState<Machine[]>([]);
  // No mobile o formulário começa fechado para não empurrar a lista.
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [costs, setCosts] = useState<MachineCostSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<MachineType>('TRATOR');
  const [brand, setBrand] = useState('');
  const [year, setYear] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<MachineType>('TRATOR');
  const [editBrand, setEditBrand] = useState('');
  const [editYear, setEditYear] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [machinesData, costsData] = await Promise.all([
        apiFetch<Machine[]>(`/fazendas/${farmId}/maquinas`, { token: accessToken }),
        apiFetch<MachineCostSummary[]>(`/fazendas/${farmId}/maquinas/custos`, { token: accessToken }),
      ]);
      setMachines(machinesData);
      setCosts(costsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar máquinas');
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

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch<Machine>(`/fazendas/${farmId}/maquinas`, {
        method: 'POST',
        token: accessToken,
        body: { name, type, brand: brand || undefined, year: year ? Number(year) : undefined },
      });
      setName('');
      setBrand('');
      setYear('');
      setCreatingOpen(false);
      await loadData();
      toastSuccess('Máquina cadastrada.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar máquina');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(machine: Machine) {
    setEditingId(machine.id);
    setEditName(machine.name);
    setEditType(machine.type);
    setEditBrand(machine.brand ?? '');
    setEditYear(machine.year ? String(machine.year) : '');
  }

  async function handleSaveEdit(machineId: string) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/maquinas/${machineId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          name: editName,
          type: editType,
          brand: editBrand || undefined,
          year: editYear ? Number(editYear) : undefined,
        },
      });
      setEditingId(null);
      await loadData();
      toastSuccess('Máquina atualizada.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar máquina');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(machine: Machine) {
    const ok = await confirm({
      title: 'Excluir máquina',
      message: `Excluir a máquina ${machine.name}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/maquinas/${machine.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
      toastSuccess('Máquina excluída.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir máquina');
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
        icon={Tractor}
        title="Máquinas"
        subtitle="Frota, manutenções e custos"
        backHref={`/fazendas/${farmId}`}
        actions={<NewRecordButton label="Nova máquina" onClick={() => setCreatingOpen(true)} />}
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {creatingOpen && (
        <FormModal
          icon={Tractor}
          title="Nova máquina"
          subtitle="Cadastre um item da frota"
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
          <label className="text-sm font-medium text-gray-700">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MachineType)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Ano</label>
          <input
            type="number"
            min="1900"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700">Marca (opcional)</label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
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
            {creating ? 'Cadastrando...' : 'Cadastrar máquina'}
          </button>
        </div>
      </form>
        </FormModal>
      )}

      {fetching ? (
        <p className="text-sm text-gray-400">Carregando máquinas...</p>
      ) : machines.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-gray-100/60 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
            <Tractor size={22} strokeWidth={1.9} />
          </span>
          <p className="mt-4 text-lg font-bold text-gray-900">Nenhuma máquina cadastrada</p>
          <p className="mt-1 text-sm text-gray-500">Cadastre tratores, implementos e veículos para acompanhar manutenções e custos.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {machines.map((machine) => {
            const cost = costs.find((c) => c.machineId === machine.id);
            if (editingId === machine.id) {
              return (
                <li
                  key={machine.id}
                  className="grid grid-cols-2 gap-3 rounded-2xl border border-emerald-600 bg-white p-5 sm:grid-cols-4"
                >
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
                    <label className="text-sm font-medium text-gray-700">Tipo</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as MachineType)}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      {TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Ano</label>
                    <input
                      type="number"
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-700">Marca</label>
                    <input
                      type="text"
                      value={editBrand}
                      onChange={(e) => setEditBrand(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                  <div className="col-span-full flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveEdit(machine.id)}
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
                  </div>
                </li>
              );
            }
            return (
              <li
                key={machine.id}
                className="flex flex-col gap-2 rounded-2xl border border-gray-200/70 bg-white px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_10px_30px_-12px_rgba(6,30,20,0.15)] sm:flex-row sm:items-center sm:justify-between"
              >
                <Link href={`/fazendas/${farmId}/maquinas/${machine.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700"><Tractor size={18} strokeWidth={1.9} /></span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900">{machine.name}</span>
                    <span className="block truncate text-sm text-gray-500">
                      {typeLabel(machine.type)} · {machine.currentHourMeter}h
                    </span>
                  </span>
                </Link>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {cost && (
                    <p className="text-sm text-gray-500">Custo: {formatCurrency(cost.totalCost)}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(machine)}
                    className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(machine)}
                    className="text-sm font-semibold text-red-600 hover:text-red-700"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
