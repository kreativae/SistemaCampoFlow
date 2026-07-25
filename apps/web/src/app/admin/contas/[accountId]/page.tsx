'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/lib/confirm-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { AccountDetail, PlanTier, SubscriptionStatus } from '@/lib/types';
import { SUBSCRIPTION_STATUS_LABEL, paymentStatusLabel } from '@/lib/types';

const PLAN_OPTIONS: PlanTier[] = ['TRIAL', 'BASICO', 'PROFISSIONAL', 'ENTERPRISE'];
const STATUS_OPTIONS: SubscriptionStatus[] = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'SUSPENDED',
];

export default function AdminAccountDetailPage() {
  const { accessToken } = useAuth();
  const confirm = useConfirm();
  const router = useRouter();
  const params = useParams<{ accountId: string }>();

  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Ações rápidas de suporte
  const [trialDays, setTrialDays] = useState(15);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');

  const [name, setName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [document, setDocument] = useState('');

  const loadAccount = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<AccountDetail>(`/admin/contas/${params.accountId}`, {
        token: accessToken,
      });
      setAccount(data);
      setName(data.name);
      setBillingEmail(data.billingEmail);
      setDocument(data.document ?? '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar conta');
    } finally {
      setFetching(false);
    }
  }, [accessToken, params.accountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccount();
  }, [loadAccount]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/contas/${params.accountId}`, {
        method: 'PATCH',
        token: accessToken,
        body: { name, billingEmail, document: document || null },
      });
      await loadAccount();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar conta');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAdmin(userId: string, isAccountAdmin: boolean) {
    setSavingUserId(userId);
    setError(null);
    try {
      await apiFetch(`/admin/contas/${params.accountId}/usuarios/${userId}`, {
        method: 'PATCH',
        token: accessToken,
        body: { isAccountAdmin },
      });
      await loadAccount();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar usuário');
    } finally {
      setSavingUserId(null);
    }
  }

  function startEditUser(user: AccountDetail['users'][number]) {
    setEditingUserId(user.id);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserPassword('');
    setError(null);
  }

  function cancelEditUser() {
    setEditingUserId(null);
    setEditUserPassword('');
  }

  async function handleSaveUser(userId: string) {
    setSavingUserId(userId);
    setError(null);
    try {
      await apiFetch(`/admin/contas/${params.accountId}/usuarios/${userId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          name: editUserName,
          email: editUserEmail,
          ...(editUserPassword ? { password: editUserPassword } : {}),
        },
      });
      setEditingUserId(null);
      setEditUserPassword('');
      await loadAccount();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar usuário');
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleSubscriptionChange(field: 'planTier' | 'status', value: string) {
    setSavingSubscription(true);
    setError(null);
    try {
      await apiFetch(`/admin/contas/${params.accountId}/assinatura`, {
        method: 'PATCH',
        token: accessToken,
        body: { [field]: value },
      });
      await loadAccount();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar assinatura');
    } finally {
      setSavingSubscription(false);
    }
  }

  async function handleExtendTrial() {
    setActionBusy('trial');
    setError(null);
    setActionMessage(null);
    try {
      await apiFetch(`/admin/contas/${params.accountId}/estender-trial`, {
        method: 'POST',
        token: accessToken,
        body: { days: trialDays },
      });
      setActionMessage(`Teste estendido em ${trialDays} dia(s).`);
      await loadAccount();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao estender o teste');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleGenerateNotifications() {
    setActionBusy('notif');
    setError(null);
    setActionMessage(null);
    try {
      const res = await apiFetch<{ farms: number; created: number }>(
        `/admin/contas/${params.accountId}/gerar-notificacoes`,
        { method: 'POST', token: accessToken },
      );
      setActionMessage(
        `${res.created} notificação(ões) gerada(s) em ${res.farms} fazenda(s).`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao gerar notificações');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDeleteAccount() {
    if (!account) return;
    const confirmed = await confirm({
      title: 'Excluir conta',
      message:
        `ATENÇÃO: excluir a conta "${account.name}" é IRREVERSÍVEL.\n\n` +
        'Todas as propriedades, usuários, tickets e a assinatura (cancelada no Stripe) ' +
        'serão apagados permanentemente.\n\n' +
        'Não será possível recuperar esses dados depois.',
      confirmLabel: 'Excluir definitivamente',
      danger: true,
      requireText: account.name,
      requireTextLabel: `Para confirmar, digite o nome exato da conta ("${account.name}")`,
    });
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/admin/contas/${params.accountId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir conta');
      setDeleting(false);
    }
  }

  if (fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </main>
    );
  }

  if (!account) {
    return (
      <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error ?? 'Conta não encontrada.'}</p>
      </main>
    );
  }

  return (
    <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/admin" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
        ← Voltar para Contas e assinaturas
      </Link>

      <h1 className="mt-2 mb-6 text-[28px] font-bold tracking-[-0.02em] text-gray-900">{account.name}</h1>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="mb-8 rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold tracking-tight text-gray-900">Dados da conta</h2>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">E-mail de cobrança</label>
            <input
              type="email"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Documento (CPF/CNPJ)
            </label>
            <input
              type="text"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </section>

      {account.subscription && (
        <section className="mb-8 rounded-2xl border border-gray-200/70 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold tracking-tight text-gray-900">Assinatura</h2>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Plano</label>
              <select
                value={account.subscription.planTier}
                disabled={savingSubscription}
                onChange={(e) => handleSubscriptionChange('planTier', e.target.value)}
                className="mt-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {PLAN_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={account.subscription.status}
                disabled={savingSubscription}
                onChange={(e) => handleSubscriptionChange('status', e.target.value)}
                className="mt-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {SUBSCRIPTION_STATUS_LABEL[opt]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      <section className="mb-8 rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold tracking-tight text-gray-900">Ações de suporte</h2>
        {actionMessage && (
          <p className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {actionMessage}
          </p>
        )}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Estender teste (dias)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value))}
                className="mt-1 w-24 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <button
              type="button"
              onClick={handleExtendTrial}
              disabled={!account.subscription || actionBusy !== null || trialDays < 1}
              className="rounded-full bg-gray-900/5 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10 disabled:opacity-40"
            >
              {actionBusy === 'trial' ? 'Estendendo...' : 'Estender teste'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleGenerateNotifications}
            disabled={actionBusy !== null}
            className="rounded-full bg-gray-900/5 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10 disabled:opacity-40"
          >
            {actionBusy === 'notif' ? 'Gerando...' : 'Gerar notificações agora'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          &quot;Estender teste&quot; recoloca a assinatura em período de teste. &quot;Gerar
          notificações&quot; varre as fazendas desta conta e cria os alertas pendentes na hora.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold tracking-tight text-gray-900">Membros da conta</h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Admin da conta</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {account.users.map((user) =>
              editingUserId === user.id ? (
                <tr key={user.id} className="border-t border-gray-100 bg-gray-50/70">
                  <td className="px-4 py-3" colSpan={4}>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Nome
                        </label>
                        <input
                          type="text"
                          value={editUserName}
                          onChange={(e) => setEditUserName(e.target.value)}
                          className="mt-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          E-mail (login)
                        </label>
                        <input
                          type="email"
                          value={editUserEmail}
                          onChange={(e) => setEditUserEmail(e.target.value)}
                          className="mt-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Nova senha
                        </label>
                        <input
                          type="password"
                          value={editUserPassword}
                          onChange={(e) => setEditUserPassword(e.target.value)}
                          placeholder="Deixe em branco para manter"
                          className="mt-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveUser(user.id)}
                        disabled={savingUserId === user.id}
                        className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
                      >
                        {savingUserId === user.id ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditUser}
                        className="rounded-full bg-gray-900/5 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={user.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50/70">
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={user.isAccountAdmin}
                      disabled={savingUserId === user.id}
                      onChange={(e) => handleToggleAdmin(user.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => startEditUser(user)}
                      className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold tracking-tight text-gray-900">Propriedades e membros</h2>
        {account.farms.length === 0 ? (
          <p className="rounded-2xl bg-gray-100/60 px-6 py-14 text-center text-sm text-gray-500">Nenhuma propriedade cadastrada.</p>
        ) : (
          <ul className="space-y-3">
            {account.farms.map((farm) => (
              <li key={farm.id} className="rounded-2xl border border-gray-200/70 bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{farm.name}</span>
                  <span className="text-xs text-gray-400">
                    desde {new Date(farm.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {farm.memberships.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {farm.memberships.map((m) => (
                      <li key={m.user.id} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-700">{m.user.name}</span>
                        <span className="text-gray-400">({m.user.email})</span>
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          {m.role}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">Nenhum membro vinculado</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-tight text-gray-900">Histórico de pagamentos</h2>
        {account.paymentHistory.length === 0 ? (
          <p className="rounded-2xl bg-gray-100/60 px-6 py-14 text-center text-sm text-gray-500">
            Nenhum pagamento encontrado (histórico via Stripe não implementado ainda).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {account.paymentHistory.map((payment) => (
                <tr key={payment.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50/70">
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(payment.dateCreated).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    {payment.transactionAmount.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: payment.currencyId,
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{paymentStatusLabel(payment.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <section className="mt-10 border-t border-gray-200 pt-6">
        <h2 className="mb-2 text-sm font-bold tracking-tight text-red-700">Zona de risco</h2>
        <p className="mb-3 text-sm text-gray-500">
          Exclui a conta, suas propriedades, usuários e tickets permanentemente, e
          cancela a assinatura no Stripe.
        </p>
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? 'Excluindo...' : 'Excluir conta'}
        </button>
      </section>
    </main>
  );
}
