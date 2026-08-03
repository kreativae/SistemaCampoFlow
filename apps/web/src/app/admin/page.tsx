'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/lib/confirm-context';
import { apiFetch, ApiError } from '@/lib/api';
import type {
  AccountDetail,
  AccountListResponse,
  AccountSummary,
  AdminOverview,
  PlanTier,
  SubscriptionStatus,
} from '@/lib/types';
import { SUBSCRIPTION_STATUS_LABEL } from '@/lib/types';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const PLAN_OPTIONS: PlanTier[] = ['TRIAL', 'BASICO', 'PROFISSIONAL', 'ENTERPRISE'];
const STATUS_OPTIONS: SubscriptionStatus[] = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'SUSPENDED',
];

function statusBadgeClass(status: SubscriptionStatus | null) {
  if (status === 'ACTIVE' || status === 'TRIALING') return 'bg-emerald-100 text-emerald-800';
  if (status === 'PAST_DUE') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-700';
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: 'green' | 'amber' | 'red';
}) {
  const valueColor =
    accent === 'green'
      ? 'text-emerald-700'
      : accent === 'amber'
        ? 'text-amber-700'
        : accent === 'red'
          ? 'text-red-700'
          : 'text-gray-900';
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-4">
      <p className="text-[13px] font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}

export default function AdminAccountsPage() {
  const { accessToken } = useAuth();
  const confirm = useConfirm();

  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [fetching, setFetching] = useState(true);

  // Busca / filtro / paginação
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | ''>('');
  const [planFilter, setPlanFilter] = useState<PlanTier | ''>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [refreshingQuotations, setRefreshingQuotations] = useState(false);
  const [quotationsMsg, setQuotationsMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<AccountDetail | null>(null);
  const [loadingExpanded, setLoadingExpanded] = useState(false);

  const loadAccounts = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (planFilter) params.set('planTier', planFilter);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const [data, ov] = await Promise.all([
        apiFetch<AccountListResponse>(`/admin/contas?${params.toString()}`, {
          token: accessToken,
        }),
        apiFetch<AdminOverview>('/admin/overview', { token: accessToken }).catch(
          () => null,
        ),
      ]);
      setAccounts(data.items);
      setTotal(data.total);
      setOverview(ov);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar contas');
    } finally {
      setFetching(false);
    }
  }, [accessToken, search, statusFilter, planFilter, page]);

  useEffect(() => {
    // Fetching data on mount via an async callback is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccounts();
  }, [loadAccounts]);

  async function handleRefreshQuotations() {
    setRefreshingQuotations(true);
    setQuotationsMsg(null);
    setError(null);
    try {
      const res = await apiFetch<{ created: number; skipped: number }>(
        '/admin/cotacoes/atualizar',
        { method: 'POST', token: accessToken },
      );
      setQuotationsMsg(
        `Cotações atualizadas: ${res.created} nova(s), ${res.skipped} sem alteração.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar cotações');
    } finally {
      setRefreshingQuotations(false);
    }
  }

  async function handleUpdate(
    accountId: string,
    field: 'planTier' | 'status',
    value: string,
  ) {
    setSavingId(accountId);
    setError(null);
    try {
      await apiFetch(`/admin/contas/${accountId}/assinatura`, {
        method: 'PATCH',
        token: accessToken,
        body: { [field]: value },
      });
      await loadAccounts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar assinatura');
    } finally {
      setSavingId(null);
    }
  }

  function toggleSelected(accountId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(accountId);
      else next.delete(accountId);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(accounts.map((a) => a.id)) : new Set());
  }

  async function toggleExpanded(accountId: string) {
    if (expandedId === accountId) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(accountId);
    setExpandedDetail(null);
    setLoadingExpanded(true);
    try {
      const data = await apiFetch<AccountDetail>(`/admin/contas/${accountId}`, {
        token: accessToken,
      });
      setExpandedDetail(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar detalhes');
    } finally {
      setLoadingExpanded(false);
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    // Listing every selected account name in the dialog body got slow/janky once
    // dozens of accounts were selected — show only the count instead.
    const confirmed = await confirm({
      title: `Excluir ${selected.size} conta(s)`,
      message:
        `ATENÇÃO: excluir ${selected.size} conta(s) é IRREVERSÍVEL.\n\n` +
        'Propriedades, usuários, tickets e assinaturas dessas contas serão apagados ' +
        'permanentemente, e as assinaturas no Stripe serão canceladas.',
      confirmLabel: 'Excluir definitivamente',
      danger: true,
      requireText: 'EXCLUIR',
      requireTextLabel: 'Para confirmar, digite EXCLUIR',
    });
    if (!confirmed) return;

    setDeletingBulk(true);
    setError(null);
    try {
      await apiFetch('/admin/contas', {
        method: 'DELETE',
        token: accessToken,
        body: { accountIds: Array.from(selected) },
      });
      setSelected(new Set());
      await loadAccounts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir contas');
    } finally {
      setDeletingBulk(false);
    }
  }

  async function handleDeleteOne(account: AccountSummary) {
    const confirmed = await confirm({
      title: `Excluir "${account.name}"`,
      message:
        'ATENÇÃO: excluir esta conta é IRREVERSÍVEL.\n\n' +
        'Propriedades, usuários, tickets e assinatura desta conta serão apagados ' +
        'permanentemente, e a assinatura no Stripe será cancelada.',
      confirmLabel: 'Excluir definitivamente',
      danger: true,
      requireText: 'EXCLUIR',
      requireTextLabel: 'Para confirmar, digite EXCLUIR',
    });
    if (!confirmed) return;

    setDeletingId(account.id);
    setError(null);
    try {
      await apiFetch('/admin/contas', {
        method: 'DELETE',
        token: accessToken,
        body: { accountIds: [account.id] },
      });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(account.id);
        return next;
      });
      await loadAccounts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir conta');
    } finally {
      setDeletingId(null);
    }
  }

  if (fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </main>
    );
  }

  const allSelected = accounts.length > 0 && selected.size === accounts.length;

  return (
    <main className="animate-fade-up mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-gray-900">Contas e assinaturas</h1>
          <p className="text-sm text-gray-500">
            Visão restrita à equipe da plataforma. Alterar plano/status aqui não passa pelo
            Stripe — use só para suporte (conta de cortesia, corrigir assinatura travada,
            reativação manual).
          </p>
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={deletingBulk}
            className="shrink-0 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deletingBulk ? 'Excluindo...' : `Excluir selecionadas (${selected.size})`}
          </button>
        )}
      </header>

      {overview && (
        <section className="mb-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Contas" value={overview.totalAccounts} />
            <MetricCard label="MRR" value={BRL.format(overview.mrr)} accent="green" />
            <MetricCard
              label="Ativas"
              value={overview.statusCounts.ACTIVE ?? 0}
              accent="green"
            />
            <MetricCard label="Em trial" value={overview.statusCounts.TRIALING ?? 0} />
            <MetricCard
              label="Inadimplentes"
              value={overview.statusCounts.PAST_DUE ?? 0}
              accent={
                (overview.statusCounts.PAST_DUE ?? 0) > 0 ? 'amber' : undefined
              }
            />
            <MetricCard
              label="Canceladas"
              value={overview.statusCounts.CANCELED ?? 0}
              accent={(overview.statusCounts.CANCELED ?? 0) > 0 ? 'red' : undefined}
            />
            <MetricCard label="Fazendas" value={overview.totalFarms} />
            <MetricCard label="Novas contas (7d)" value={overview.newAccounts7d} />
            <MetricCard label="Novas contas (30d)" value={overview.newAccounts30d} />
            <MetricCard
              label="Tickets abertos"
              value={overview.openTickets}
              accent={overview.openTickets > 0 ? 'amber' : undefined}
            />
            <MetricCard
              label="Básico / Prof."
              value={`${overview.planCounts.BASICO ?? 0} / ${overview.planCounts.PROFISSIONAL ?? 0}`}
            />
            <MetricCard label="Enterprise" value={overview.planCounts.ENTERPRISE ?? 0} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefreshQuotations}
              disabled={refreshingQuotations}
              className="rounded-full bg-gray-900/5 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10 disabled:opacity-40"
            >
              {refreshingQuotations ? 'Atualizando...' : 'Atualizar cotações agora'}
            </button>
            {quotationsMsg && (
              <span className="text-xs text-emerald-700">{quotationsMsg}</span>
            )}
          </div>
        </section>
      )}

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {/* Busca e filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="flex flex-1 gap-2"
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome, e-mail de cobrança ou de usuário"
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
          />
          <button
            type="submit"
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98]"
          >
            Buscar
          </button>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value as SubscriptionStatus | '');
          }}
          className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {SUBSCRIPTION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={planFilter}
          onChange={(e) => {
            setPage(1);
            setPlanFilter(e.target.value as PlanTier | '');
          }}
          className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
        >
          <option value="">Todos os planos</option>
          {PLAN_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-2xl bg-gray-100/60 px-6 py-14 text-center">
          <p className="text-lg font-bold text-gray-900">
            {search || statusFilter || planFilter
              ? 'Nenhuma conta encontrada com esses filtros.'
              : 'Nenhuma conta cadastrada ainda.'}
          </p>
        </div>
      ) : (
        <>
        {/* Lista em cards — mobile */}
        <div className="space-y-3 sm:hidden">
          {accounts.map((account) => (
            <div key={account.id} className="rounded-2xl border border-gray-200/70 bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <label className="flex min-w-0 items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 shrink-0"
                    checked={selected.has(account.id)}
                    onChange={(e) => toggleSelected(account.id, e.target.checked)}
                  />
                  <span className="min-w-0">
                    <Link
                      href={`/admin/contas/${account.id}`}
                      className="block truncate font-medium text-gray-900 hover:underline"
                    >
                      {account.name}
                    </Link>
                    <span className="block truncate text-xs text-gray-400">{account.billingEmail}</span>
                  </span>
                </label>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(account.id)}
                    className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    {expandedId === account.id ? 'Ocultar' : 'Visualizar'}
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === account.id}
                    onClick={() => handleDeleteOne(account)}
                    className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {deletingId === account.id ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-sm font-medium text-gray-700">
                  Plano
                  <select
                    value={account.planTier ?? ''}
                    disabled={savingId === account.id}
                    onChange={(e) => handleUpdate(account.id, 'planTier', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-normal text-gray-900 transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {PLAN_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Status
                  <select
                    value={account.status ?? ''}
                    disabled={savingId === account.id}
                    onChange={(e) => handleUpdate(account.id, 'status', e.target.value)}
                    className={`mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-normal transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:opacity-50 ${statusBadgeClass(account.status)}`}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {SUBSCRIPTION_STATUS_LABEL[opt]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {account.farmsUsed} fazenda(s) · {account.owner?.email ?? 'sem responsável'} · criada em{' '}
                {new Date(account.createdAt).toLocaleDateString('pt-BR')}
              </p>
              {expandedId === account.id && (
                <div className="mt-3 rounded-2xl bg-gray-100/60 p-5">
                  {loadingExpanded ? (
                    <p className="text-sm text-gray-400">Carregando...</p>
                  ) : expandedDetail ? (
                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Fim do teste</p>
                        <p>
                          {expandedDetail.subscription?.trialEndsAt
                            ? new Date(expandedDetail.subscription.trialEndsAt).toLocaleDateString('pt-BR')
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Fim do período atual</p>
                        <p>
                          {expandedDetail.subscription?.currentPeriodEnd
                            ? new Date(expandedDetail.subscription.currentPeriodEnd).toLocaleDateString('pt-BR')
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Membros</p>
                        <p>{expandedDetail.users.length}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-red-700">Erro ao carregar detalhes.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Tabela — desktop/tablet */}
        <div className="hidden overflow-x-auto rounded-2xl border border-gray-200/70 bg-white sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
              <th className="w-8 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
              </th>
              <th className="px-3 py-3">Conta</th>
              <th className="hidden px-3 py-3 md:table-cell">Responsável</th>
              <th className="hidden px-3 py-3 sm:table-cell">Fazendas</th>
              <th className="px-3 py-3">Plano</th>
              <th className="px-3 py-3">Status</th>
              <th className="hidden px-3 py-3 lg:table-cell">Criada em</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <Fragment key={account.id}>
                <tr className="border-t border-gray-100 transition-colors hover:bg-gray-50/70">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(account.id)}
                      onChange={(e) => toggleSelected(account.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/contas/${account.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {account.name}
                    </Link>
                    <p className="text-xs text-gray-400">{account.billingEmail}</p>
                  </td>
                  <td className="hidden px-3 py-3 text-gray-600 md:table-cell">{account.owner?.email ?? '—'}</td>
                  <td className="hidden px-3 py-3 sm:table-cell">{account.farmsUsed}</td>
                  <td className="px-3 py-3">
                    <select
                      value={account.planTier ?? ''}
                      disabled={savingId === account.id}
                      onChange={(e) => handleUpdate(account.id, 'planTier', e.target.value)}
                      className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      {PLAN_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={account.status ?? ''}
                      disabled={savingId === account.id}
                      onChange={(e) => handleUpdate(account.id, 'status', e.target.value)}
                      className={`rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:opacity-50 ${statusBadgeClass(account.status)}`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {SUBSCRIPTION_STATUS_LABEL[opt]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="hidden px-3 py-3 text-gray-500 lg:table-cell">
                    {new Date(account.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(account.id)}
                        className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                      >
                        {expandedId === account.id ? 'Ocultar' : 'Visualizar'}
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === account.id}
                        onClick={() => handleDeleteOne(account)}
                        className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingId === account.id ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === account.id && (
                  <tr className="border-t border-gray-100 bg-gray-100/60">
                    <td colSpan={8} className="px-4 py-4">
                      {loadingExpanded ? (
                        <p className="text-sm text-gray-400">Carregando...</p>
                      ) : expandedDetail ? (
                        <div className="grid grid-cols-2 gap-4 text-xs text-gray-700 sm:grid-cols-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Fim do teste</p>
                            <p>
                              {expandedDetail.subscription?.trialEndsAt
                                ? new Date(
                                    expandedDetail.subscription.trialEndsAt,
                                  ).toLocaleDateString('pt-BR')
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                              Fim do período atual
                            </p>
                            <p>
                              {expandedDetail.subscription?.currentPeriodEnd
                                ? new Date(
                                    expandedDetail.subscription.currentPeriodEnd,
                                  ).toLocaleDateString('pt-BR')
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Membros</p>
                            <p>{expandedDetail.users.length}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-red-700">Erro ao carregar detalhes.</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
        </>
      )}

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-full bg-gray-900/5 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pageSize >= total}
              className="rounded-full bg-gray-900/5 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
