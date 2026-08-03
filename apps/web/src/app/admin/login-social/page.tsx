'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import type { OAuthProvider, OAuthProviderStatus } from '@/lib/types';

const SOURCE_LABEL: Record<OAuthProviderStatus['source'], string> = {
  banco: 'Configurado por esta tela',
  variavel_de_ambiente: 'Vindo de variável de ambiente',
  nenhum: 'Não configurado',
};

// Onde cada provedor é registrado, para o admin não precisar caçar.
const CONSOLE_HINT: Record<OAuthProvider, { url: string; label: string; note: string }> = {
  GOOGLE: {
    url: 'https://console.cloud.google.com/apis/credentials',
    label: 'Google Cloud Console → Credenciais → ID do cliente OAuth',
    note: 'Cadastre a URL de redirecionamento abaixo em "URIs de redirecionamento autorizados".',
  },
  MICROSOFT: {
    url: 'https://entra.microsoft.com',
    label: 'Microsoft Entra ID → Registros de aplicativo',
    note: 'Em "Tipos de conta com suporte", escolha a opção que inclui contas pessoais, senão só contas corporativas conseguem entrar.',
  },
  APPLE: {
    url: 'https://developer.apple.com/account/resources/identifiers/list/serviceId',
    label: 'Apple Developer → Identifiers → Services IDs',
    note: 'Requer Apple Developer Program (US$ 99/ano). Ainda não implementado.',
  },
};

export default function AdminSocialLoginPage() {
  const { accessToken } = useAuth();
  const { toastSuccess } = useToast();
  const [providers, setProviders] = useState<OAuthProviderStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<OAuthProviderStatus[]>('/admin/oauth/config', {
        token: accessToken,
      });
      setProviders(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar provedores');
    }
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <main className="animate-fade-up mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8">
      <header className="mb-8">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-gray-900">Login social</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Credenciais dos provedores de entrada. Salvar aqui vale mais que a variável de
          ambiente e não exige novo deploy.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {providers === null ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-6">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.provider}
              status={provider}
              token={accessToken}
              onSaved={(updated) => {
                setProviders(updated);
                toastSuccess(`${provider.label} atualizado.`);
              }}
              onError={setError}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ProviderCard({
  status,
  token,
  onSaved,
  onError,
}: {
  status: OAuthProviderStatus;
  token: string | null;
  onSaved: (updated: OAuthProviderStatus[]) => void;
  onError: (message: string) => void;
}) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const hint = CONSOLE_HINT[status.provider];

  async function save(payload: {
    clientId?: string;
    clientSecret?: string;
    enabled?: boolean;
  }) {
    setSaving(true);
    try {
      const updated = await apiFetch<OAuthProviderStatus[]>(
        `/admin/oauth/config/${status.provider.toLowerCase()}`,
        { method: 'PATCH', token, body: payload },
      );
      setClientId('');
      setClientSecret('');
      onSaved(updated);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await save({ clientId, clientSecret });
  }

  return (
    <section className="rounded-2xl border border-gray-200/70 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold tracking-tight text-gray-900">{status.label}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{SOURCE_LABEL[status.source]}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              status.enabled && status.configured
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {status.enabled && status.configured ? 'Ativo no login' : 'Inativo'}
          </span>
          <button
            type="button"
            disabled={saving || !status.configured}
            onClick={() => save({ enabled: !status.enabled })}
            title={
              status.configured
                ? undefined
                : 'Configure Client ID e Secret antes de ativar'
            }
            className="rounded-full bg-gray-900/5 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10 disabled:opacity-50"
          >
            {status.enabled ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl bg-gray-100/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">
          URL de redirecionamento
        </p>
        <code className="mt-1 block break-all text-sm text-gray-800">
          {status.redirectUri}
        </code>
        <p className="mt-2 text-xs text-gray-500">
          {hint.note}{' '}
          <a
            href={hint.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 hover:text-emerald-900"
          >
            {hint.label}
          </a>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-gray-700">
            Client ID
            {status.clientIdMasked && (
              <span className="ml-1 font-normal text-gray-400">
                (atual: {status.clientIdMasked})
              </span>
            )}
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={status.clientIdMasked ? 'Deixe vazio para manter' : ''}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">
            Client Secret
            {status.secretSet && (
              <span className="ml-1 font-normal text-gray-400">(já definido)</span>
            )}
          </label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={status.secretSet ? 'Deixe vazio para manter' : ''}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving || (!clientId && !clientSecret)}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar credenciais'}
          </button>
        </div>
      </form>
    </section>
  );
}
