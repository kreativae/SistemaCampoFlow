'use client';

import { ArrowDownCircle, ArrowUpCircle, Check, Clock, Pencil, TrendingUp, Undo2, Wallet, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import NewRecordButton from '@/components/NewRecordButton';
import ToolButton from '@/components/ToolButton';
import FormModal from '@/components/FormModal';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import type {
  CashFlowBucket,
  CropCycle,
  Transaction,
  TransactionCategory,
  TransactionType,
} from '@/lib/types';

const TYPE_OPTIONS: TransactionType[] = ['RECEITA', 'DESPESA'];
const CATEGORY_OPTIONS: TransactionCategory[] = [
  'NUTRICAO',
  'MEDICAMENTOS',
  'FUNCIONARIOS',
  'COMBUSTIVEL',
  'MAQUINARIO',
  'ENERGIA',
  'VENDA_ANIMAL',
  'OUTROS',
];
const GRANULARITY_OPTIONS: { value: 'daily' | 'weekly' | 'monthly'; label: string }[] = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
];

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function FinancePage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const { toastSuccess } = useToast();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // No mobile o formulário começa fechado para não empurrar a lista para baixo.
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [cashFlowOpen, setCashFlowOpen] = useState(false);
  const [cashFlow, setCashFlow] = useState<CashFlowBucket[]>([]);
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [txFilter, setTxFilter] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('all');
  const [fetching, setFetching] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [type, setType] = useState<TransactionType>('DESPESA');
  const [category, setCategory] = useState<TransactionCategory>('OUTROS');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [cropCycleId, setCropCycleId] = useState('');
  const [cropCycles, setCropCycles] = useState<CropCycle[]>([]);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editType, setEditType] = useState<TransactionType>('DESPESA');
  const [editCategory, setEditCategory] = useState<TransactionCategory>('OUTROS');
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const filteredTransactions = useMemo(() => {
    if (txFilter === 'all') return transactions;
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    if (txFilter === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (txFilter === 'week') {
      const day = now.getDay();
      start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (txFilter === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
    }
    return transactions.filter((t) => {
      const ref = new Date(t.paidAt ?? t.dueDate);
      return ref >= start && ref <= end;
    });
  }, [transactions, txFilter]);

  const summary = useMemo(() => {
    const receita = filteredTransactions
      .filter((t) => t.type === 'RECEITA')
      .reduce((s, t) => s + t.amount, 0);
    const despesa = filteredTransactions
      .filter((t) => t.type === 'DESPESA')
      .reduce((s, t) => s + t.amount, 0);
    const pendentes = filteredTransactions.filter((t) => !t.paidAt).length;
    return { receita, despesa, saldo: receita - despesa, pendentes };
  }, [filteredTransactions]);

  const loadTransactions = useCallback(async () => {
    try {
      const data = await apiFetch<Transaction[]>(`/fazendas/${farmId}/lancamentos`, {
        token: accessToken,
      });
      setTransactions(data);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        return false;
      }
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar lançamentos');
      return false;
    }
  }, [farmId, accessToken]);

  const loadCashFlow = useCallback(async () => {
    try {
      const data = await apiFetch<CashFlowBucket[]>(
        `/fazendas/${farmId}/financeiro/fluxo-caixa?granularity=${granularity}`,
        { token: accessToken },
      );
      setCashFlow(data);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 403)) {
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar fluxo de caixa');
      }
    }
  }, [farmId, accessToken, granularity]);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    const ok = await loadTransactions();
    if (ok) {
      await loadCashFlow();
      try {
        const safras = await apiFetch<CropCycle[]>(`/fazendas/${farmId}/safras`, {
          token: accessToken,
        });
        setCropCycles(safras);
      } catch {
        setCropCycles([]);
      }
    }
    setFetching(false);
  }, [loadTransactions, loadCashFlow, farmId, accessToken]);

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

  useEffect(() => {
    if (loading || !user || forbidden) return;
    // Re-fetching when the user changes the granularity selector is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCashFlow();
    // Only the granularity change should re-trigger this fetch; loadCashFlow itself
    // already depends on accessToken/farmId and is recreated when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await apiFetch<Transaction>(`/fazendas/${farmId}/lancamentos`, {
        method: 'POST',
        token: accessToken,
        body: {
          type,
          category,
          description: description || undefined,
          amount: Number(amount),
          dueDate,
          paidAt: alreadyPaid ? today : undefined,
          cropCycleId: cropCycleId || undefined,
        },
      });
      setDescription('');
      setAmount('');
      setDueDate('');
      setAlreadyPaid(false);
      setCropCycleId('');
      setCreatingOpen(false);
      await loadData();
      toastSuccess('Lançamento criado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar lançamento');
    } finally {
      setCreating(false);
    }
  }

  async function handleMarkPaid(transactionId: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/lancamentos/${transactionId}/pagar`, {
        method: 'PATCH',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao marcar como pago');
    }
  }

  async function handleMarkUnpaid(transactionId: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/lancamentos/${transactionId}/desfazer-pagamento`, {
        method: 'PATCH',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao desfazer pagamento');
    }
  }

  function startEdit(t: Transaction) {
    setEditingTx(t);
    setEditType(t.type);
    setEditCategory(t.category);
    setEditDescription(t.description ?? '');
    setEditAmount(String(t.amount));
    setEditDueDate(t.dueDate.slice(0, 10));
  }

  async function handleSaveEdit() {
    if (!editingTx) return;
    setSavingEdit(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/lancamentos/${editingTx.id}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          type: editType,
          category: editCategory,
          description: editDescription || undefined,
          amount: Number(editAmount),
          dueDate: editDueDate,
        },
      });
      setEditingTx(null);
      await loadData();
      toastSuccess('Lançamento atualizado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar lançamento');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(transactionId: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/lancamentos/${transactionId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir lançamento');
    }
  }

  if (loading || !user || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="animate-fade-up mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
      <PageHeader
        icon={Wallet}
        title="Financeiro"
        subtitle="Lançamentos e fluxo de caixa"
        backHref={`/fazendas/${farmId}`}
        actions={
          forbidden ? undefined : (
            <div className="flex items-center gap-2">
              <ToolButton
                icon={TrendingUp}
                label="Fluxo de caixa"
                onClick={() => setCashFlowOpen(true)}
              />
              <NewRecordButton label="Novo lançamento" onClick={() => setCreatingOpen(true)} />
            </div>
          )
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {forbidden ? (
        <p className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3 text-sm text-gray-500">
          Seu perfil não tem permissão para visualizar os dados financeiros desta propriedade.
        </p>
      ) : (
        <>
          {creatingOpen && (
            <FormModal
              icon={Wallet}
              title="Novo lançamento"
              subtitle="Registre uma receita ou despesa"
              onClose={() => setCreatingOpen(false)}
            >
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <div>
              <label className="text-sm font-medium text-gray-700">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'RECEITA' ? 'Receita' : 'Despesa'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Vencimento</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            <div className="col-span-2 sm:col-span-3">
              <label className="text-sm font-medium text-gray-700">Descrição (opcional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            {cropCycles.length > 0 && (
              <div className="col-span-2 sm:col-span-3">
                <label className="text-sm font-medium text-gray-700">
                  Vincular a uma safra (opcional)
                </label>
                <select
                  value={cropCycleId}
                  onChange={(e) => setCropCycleId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">Sem vínculo</option>
                  {cropCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.cropName}
                      {c.variety ? ` — ${c.variety}` : ''} ·{' '}
                      {new Date(c.plantedAt).toLocaleDateString('pt-BR')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2 self-end pb-1.5">
              <input
                id="alreadyPaid"
                type="checkbox"
                checked={alreadyPaid}
                onChange={(e) => setAlreadyPaid(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="alreadyPaid" className="text-sm font-medium text-gray-700">
                Já pago/recebido
              </label>
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
                {creating ? 'Salvando...' : 'Lançar'}
              </button>
            </div>
          </form>
            </FormModal>
          )}

          {cashFlowOpen && (
            <FormModal
              icon={TrendingUp}
              title="Fluxo de caixa"
              subtitle="Receita, despesa e saldo por período"
              maxWidth="max-w-2xl"
              onClose={() => setCashFlowOpen(false)}
            >
            <div className="mb-3 flex items-center justify-end">
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as 'daily' | 'weekly' | 'monthly')}
                className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
              >
                {GRANULARITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {cashFlow.length === 0 ? (
              <p className="text-sm text-gray-500">Sem dados para o período.</p>
            ) : (
              <div className="overflow-x-auto">
              {/* min-w-full + nowrap: em telas estreitas a tabela rola dentro do
                  container em vez de espremer as colunas uma sobre a outra. */}
              <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                    <th className="py-1 pr-6">Período</th>
                    <th className="py-1 pr-6 text-right">Receita</th>
                    <th className="py-1 pr-6 text-right">Despesa</th>
                    <th className="py-1 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {cashFlow.map((bucket) => (
                    <tr key={bucket.period} className="border-t border-gray-100 transition-colors hover:bg-gray-50/70">
                      <td className="py-1.5 pr-6">{bucket.period}</td>
                      <td className="py-1.5 pr-6 text-right text-emerald-700">{formatCurrency(bucket.receita)}</td>
                      <td className="py-1.5 pr-6 text-right text-red-600">{formatCurrency(bucket.despesa)}</td>
                      <td className="py-1.5 text-right font-medium">{formatCurrency(bucket.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            </FormModal>
          )}

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-gray-200/70 bg-white p-5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-gray-500">
                <ArrowUpCircle size={14} className="text-emerald-500" />
                Receita
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-emerald-600">{formatCurrency(summary.receita)}</p>
            </div>
            <div className="rounded-2xl border border-gray-200/70 bg-white p-5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-gray-500">
                <ArrowDownCircle size={14} className="text-red-500" />
                Despesa
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-red-500">{formatCurrency(summary.despesa)}</p>
            </div>
            <div className="rounded-2xl border border-gray-200/70 bg-white p-5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-gray-500">
                <Wallet size={14} className="text-gray-400" />
                Saldo
              </div>
              <p className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${summary.saldo >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatCurrency(summary.saldo)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200/70 bg-white p-5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-gray-500">
                <Clock size={14} className="text-amber-500" />
                Pendentes
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-amber-600">{summary.pendentes}</p>
            </div>
          </div>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold tracking-tight text-gray-900">Lançamentos</h2>
              <div className="flex flex-wrap gap-1">
                {([['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano'], ['all', 'Todos']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTxFilter(val)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ${
                      txFilter === val
                        ? 'bg-emerald-700 text-white'
                        : 'bg-gray-900/5 text-gray-600 hover:bg-gray-900/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl bg-gray-100/60 px-6 py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
                  <Wallet size={22} strokeWidth={1.8} />
                </span>
                <p className="mt-4 text-lg font-bold text-gray-900">
                  {transactions.length === 0 ? 'Nenhum lançamento' : 'Nenhum lançamento no período'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {transactions.length === 0
                    ? 'Registre receitas e despesas para acompanhar o fluxo de caixa da propriedade.'
                    : 'Altere o filtro para ver outros lançamentos.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredTransactions.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-4 rounded-2xl border border-gray-200/70 bg-white px-4 py-3"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        t.type === 'RECEITA' ? 'bg-emerald-600/10 text-emerald-700' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {t.type === 'RECEITA' ? (
                        <ArrowUpCircle size={20} strokeWidth={1.8} />
                      ) : (
                        <ArrowDownCircle size={20} strokeWidth={1.8} />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-gray-900">
                          {t.description || t.category}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            t.paidAt
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {t.paidAt ? <Check size={10} /> : <Clock size={10} />}
                          {t.paidAt ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {new Date(t.dueDate).toLocaleDateString('pt-BR')} · {t.category}
                      </p>
                    </div>

                    <p
                      className={`shrink-0 text-right text-sm font-bold tabular-nums ${
                        t.type === 'RECEITA' ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {t.type === 'RECEITA' ? '+' : '-'}{formatCurrency(t.amount)}
                    </p>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => startEdit(t)}
                        className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      {!t.paidAt ? (
                        <button
                          onClick={() => handleMarkPaid(t.id)}
                          className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                          title="Marcar como pago"
                        >
                          <Check size={15} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkUnpaid(t.id)}
                          className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                          title="Marcar como pendente"
                        >
                          <Undo2 size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        title="Excluir"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {editingTx && (
            <Modal onClose={() => setEditingTx(null)}>
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
                    <Pencil size={19} strokeWidth={1.9} />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-gray-900">Editar lançamento</h2>
                    <p className="text-xs text-gray-500">{formatCurrency(editingTx.amount)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="rounded-full p-1.5 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 px-6 py-5">
                <div>
                  <label className="text-sm font-medium text-gray-700">Tipo</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as TransactionType)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === 'RECEITA' ? 'Receita' : 'Despesa'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Categoria</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as TransactionCategory)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Vencimento</label>
                  <input
                    type="date"
                    required
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Descrição (opcional)</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="rounded-full bg-gray-900/5 px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={handleSaveEdit}
                  className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
                >
                  {savingEdit ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </main>
  );
}
