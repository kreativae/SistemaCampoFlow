'use client';

import { Package } from 'lucide-react';
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
import type { Supply, SupplyAlert, SupplyCategory } from '@/lib/types';

const CATEGORY_OPTIONS: { value: SupplyCategory; label: string }[] = [
  { value: 'SAL_MINERAL', label: 'Sal Mineral' },
  { value: 'RACAO', label: 'Ração' },
  { value: 'FERTILIZANTE', label: 'Fertilizante' },
  { value: 'HERBICIDA', label: 'Herbicida' },
  { value: 'DEFENSIVO', label: 'Defensivo' },
  { value: 'OUTROS', label: 'Outros' },
];

const UNIT_OPTIONS = ['kg', 't', 'L', 'mL', 'un', 'sc', 'fardo', 'dose'];
const CUSTOM_UNIT = '__custom__';

function categoryLabel(supply: { category: SupplyCategory; customCategory: string | null }) {
  if (supply.category === 'OUTROS' && supply.customCategory) {
    return supply.customCategory;
  }
  return CATEGORY_OPTIONS.find((opt) => opt.value === supply.category)?.label ?? supply.category;
}

export default function SuppliesPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const { toastSuccess } = useToast();
  const router = useRouter();
  const confirm = useConfirm();

  const [supplies, setSupplies] = useState<Supply[]>([]);
  // No mobile o formulário começa fechado para não empurrar a lista.
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [alerts, setAlerts] = useState<SupplyAlert[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<SupplyCategory>('SAL_MINERAL');
  const [customCategory, setCustomCategory] = useState('');
  const [unitSelect, setUnitSelect] = useState('kg');
  const [customUnit, setCustomUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<SupplyCategory>('SAL_MINERAL');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [editUnitSelect, setEditUnitSelect] = useState('kg');
  const [editCustomUnit, setEditCustomUnit] = useState('');
  const [editMinimumQuantity, setEditMinimumQuantity] = useState('');
  const [editExpirationDate, setEditExpirationDate] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [suppliesData, alertsData] = await Promise.all([
        apiFetch<Supply[]>(`/fazendas/${farmId}/insumos`, { token: accessToken }),
        apiFetch<SupplyAlert[]>(`/fazendas/${farmId}/insumos/alertas`, { token: accessToken }),
      ]);
      setSupplies(suppliesData);
      setAlerts(alertsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar insumos');
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
      await apiFetch<Supply>(`/fazendas/${farmId}/insumos`, {
        method: 'POST',
        token: accessToken,
        body: {
          name,
          category,
          customCategory: category === 'OUTROS' ? customCategory || undefined : undefined,
          unit: unitSelect === CUSTOM_UNIT ? customUnit : unitSelect,
          initialQuantity: quantity ? Number(quantity) : undefined,
          expirationDate: expirationDate || undefined,
        },
      });
      setName('');
      setCustomCategory('');
      setCustomUnit('');
      setQuantity('');
      setExpirationDate('');
      setCreatingOpen(false);
      await loadData();
      toastSuccess('Insumo cadastrado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar insumo');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(supply: Supply) {
    setEditingId(supply.id);
    setEditName(supply.name);
    setEditCategory(supply.category);
    setEditCustomCategory(supply.customCategory ?? '');
    if (UNIT_OPTIONS.includes(supply.unit)) {
      setEditUnitSelect(supply.unit);
      setEditCustomUnit('');
    } else {
      setEditUnitSelect(CUSTOM_UNIT);
      setEditCustomUnit(supply.unit);
    }
    setEditMinimumQuantity(String(supply.minimumQuantity));
    setEditExpirationDate(supply.expirationDate ? supply.expirationDate.slice(0, 10) : '');
  }

  async function handleSaveEdit(supplyId: string) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/insumos/${supplyId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          name: editName,
          category: editCategory,
          customCategory:
            editCategory === 'OUTROS' ? editCustomCategory || undefined : undefined,
          unit: editUnitSelect === CUSTOM_UNIT ? editCustomUnit : editUnitSelect,
          minimumQuantity: Number(editMinimumQuantity),
          expirationDate: editExpirationDate || undefined,
        },
      });
      setEditingId(null);
      await loadData();
      toastSuccess('Insumo atualizado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar insumo');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(supply: Supply) {
    const ok = await confirm({
      title: 'Excluir insumo',
      message: `Excluir o insumo ${supply.name}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/insumos/${supply.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
      toastSuccess('Insumo excluído.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir insumo');
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
        icon={Package}
        title="Insumos"
        subtitle="Estoque e movimentações"
        backHref={`/fazendas/${farmId}`}
        actions={<NewRecordButton label="Novo insumo" onClick={() => setCreatingOpen(true)} />}
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {alerts.length > 0 && (
        <div className="mb-8 rounded-xl bg-amber-50 px-4 py-3">
          <h2 className="mb-2 text-sm font-bold tracking-tight text-amber-800">Alertas</h2>
          <ul className="space-y-1 text-sm font-medium text-amber-800">
            {alerts.map((a) => (
              <li key={a.id}>
                {a.name}
                {a.lowStock ? ` — estoque baixo (${a.currentQuantity}/${a.minimumQuantity} ${a.unit})` : ''}
                {a.expired
                  ? ' — vencido'
                  : a.expiringSoon
                    ? ' — vence em breve'
                    : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {creatingOpen && (
        <FormModal
          icon={Package}
          title="Novo insumo"
          subtitle="Cadastre um item de estoque"
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
          <label className="text-sm font-medium text-gray-700">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SupplyCategory)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {category === 'OUTROS' && (
            <input
              type="text"
              placeholder="Nome da categoria"
              required
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
            />
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Unidade</label>
          <select
            value={unitSelect}
            onChange={(e) => setUnitSelect(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          >
            {UNIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value={CUSTOM_UNIT}>Outra...</option>
          </select>
          {unitSelect === CUSTOM_UNIT && (
            <input
              type="text"
              placeholder="Unidade personalizada"
              required
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
            />
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Quantidade</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700">Validade (opcional)</label>
          <input
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
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
            {creating ? 'Cadastrando...' : 'Cadastrar insumo'}
          </button>
        </div>
      </form>
        </FormModal>
      )}

      {fetching ? (
        <p className="text-sm text-gray-400">Carregando insumos...</p>
      ) : supplies.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-gray-100/60 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
            <Package size={22} strokeWidth={1.9} />
          </span>
          <p className="mt-4 text-lg font-bold text-gray-900">Nenhum insumo cadastrado</p>
          <p className="mt-1 text-sm text-gray-500">Registre sal mineral, ração, fertilizantes e outros insumos da propriedade.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {supplies.map((supply) =>
            editingId === supply.id ? (
              <li
                key={supply.id}
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
                  <label className="text-sm font-medium text-gray-700">Categoria</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as SupplyCategory)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {editCategory === 'OUTROS' && (
                    <input
                      type="text"
                      placeholder="Nome da categoria"
                      value={editCustomCategory}
                      onChange={(e) => setEditCustomCategory(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Unidade</label>
                  <select
                    value={editUnitSelect}
                    onChange={(e) => setEditUnitSelect(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {UNIT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                    <option value={CUSTOM_UNIT}>Outra...</option>
                  </select>
                  {editUnitSelect === CUSTOM_UNIT && (
                    <input
                      type="text"
                      placeholder="Unidade personalizada"
                      value={editCustomUnit}
                      onChange={(e) => setEditCustomUnit(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Estoque mínimo (alertas)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editMinimumQuantity}
                    onChange={(e) => setEditMinimumQuantity(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Validade</label>
                  <input
                    type="date"
                    value={editExpirationDate}
                    onChange={(e) => setEditExpirationDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
                <div className="col-span-full flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveEdit(supply.id)}
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
            ) : (
              <li
                key={supply.id}
                className="flex flex-col gap-2 rounded-2xl border border-gray-200/70 bg-white px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_10px_30px_-12px_rgba(6,30,20,0.15)] sm:flex-row sm:items-center sm:justify-between"
              >
                <Link href={`/fazendas/${farmId}/insumos/${supply.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700"><Package size={18} strokeWidth={1.9} /></span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900">{supply.name}</span>
                    <span className="block truncate text-sm text-gray-500">{categoryLabel(supply)}</span>
                  </span>
                </Link>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <p className="text-sm text-gray-500">
                    {supply.currentQuantity} {supply.unit}
                  </p>
                  <button
                    type="button"
                    onClick={() => startEdit(supply)}
                    className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(supply)}
                    className="text-sm font-semibold text-red-600 hover:text-red-800"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </main>
  );
}
