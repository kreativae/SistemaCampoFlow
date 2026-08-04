'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Commodity } from '@/lib/types';

// O endpoint agrega por commodity+estado e não devolve id — a chave da lista
// vem do próprio par, e `changePercent` é a variação sobre o valor anterior.
interface LatestQuotation {
  commodity: Commodity;
  state: string | null;
  price: number;
  unit: string;
  source: string | null;
  recordedAt: string;
  changePercent: number;
}

const COMMODITY_OPTIONS: { value: Commodity; label: string; unit: string }[] = [
  { value: 'BOI_GORDO', label: 'Boi Gordo', unit: '@' },
  { value: 'VACA_GORDA', label: 'Vaca Gorda', unit: '@' },
  { value: 'NOVILHA', label: 'Novilha', unit: '@' },
  { value: 'BEZERRO', label: 'Bezerro', unit: 'cabeça' },
  { value: 'REPOSICAO', label: 'Reposição', unit: 'cabeça' },
  { value: 'COURO', label: 'Couro', unit: 'unidade' },
  { value: 'SEBO', label: 'Sebo', unit: 'kg' },
  { value: 'LEITE', label: 'Leite', unit: 'litro' },
  { value: 'MILHO', label: 'Milho', unit: 'sc 60kg' },
  { value: 'SOJA', label: 'Soja', unit: 'sc 60kg' },
  { value: 'SORGO', label: 'Sorgo', unit: 'sc 60kg' },
  { value: 'FARELO_SOJA', label: 'Farelo de Soja', unit: 'tonelada' },
  { value: 'MERCADO_FUTURO', label: 'Mercado Futuro', unit: '@' },
  { value: 'BOI_MUNDO', label: 'Boi no Mundo', unit: '@' },
  { value: 'ATACADO', label: 'Atacado', unit: 'kg' },
  { value: 'EQUIVALENTES', label: 'Equivalentes', unit: '@' },
];

function commodityLabel(value: Commodity) {
  return COMMODITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

const inputClasses =
  'mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10';

export default function AdminQuotationsPage() {
  const { accessToken } = useAuth();

  const [latest, setLatest] = useState<LatestQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [commodity, setCommodity] = useState<Commodity>('BOI_GORDO');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('@');
  const [source, setSource] = useState('');

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await apiFetch<LatestQuotation[]>('/admin/cotacoes', {
          token: accessToken,
        });
        setLatest(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar cotações');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Trocar a commodity troca a unidade sugerida: quem lança soja não deveria
  // precisar lembrar que a unidade é saca de 60kg.
  function selectCommodity(value: Commodity) {
    setCommodity(value);
    const preset = COMMODITY_OPTIONS.find((o) => o.value === value);
    if (preset) setUnit(preset.unit);
  }

  async function handleRefresh() {
    setRefreshing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await apiFetch<{ created: number; skipped: number }>(
        '/admin/cotacoes/atualizar',
        { method: 'POST', token: accessToken },
      );
      setMessage(`${res.created} nova(s), ${res.skipped} sem alteração.`);
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao buscar cotações');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch('/admin/cotacoes', {
        method: 'POST',
        token: accessToken,
        body: {
          commodity,
          price: Number(price),
          unit,
          source: source || 'Lançamento manual',
        },
      });
      setPrice('');
      setSource('');
      setMessage(`${commodityLabel(commodity)} atualizado.`);
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao lançar cotação');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-6">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-gray-900">Cotações</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Valores nacionais usados por todas as propriedades — o boi gordo alimenta o valor
          estimado do rebanho na Inteligência.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </p>
      )}

      <section className="mb-6 rounded-2xl border border-gray-200/70 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold tracking-tight text-gray-900">Lançar valor manualmente</h2>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-full bg-gray-900/5 px-4 py-2 text-xs font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10 disabled:opacity-40"
          >
            {refreshing ? 'Buscando...' : 'Tentar busca automática'}
          </button>
        </div>

        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-medium text-gray-700">Commodity</span>
            <select
              value={commodity}
              onChange={(e) => selectCommodity(e.target.value as Commodity)}
              className={inputClasses}
            >
              {COMMODITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-gray-700">Preço (R$)</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Ex: 318,50"
              className={inputClasses}
            />
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-gray-700">Unidade</span>
            <input
              type="text"
              required
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className={inputClasses}
            />
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-gray-700">Fonte</span>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Lançamento manual"
              className={inputClasses}
            />
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Lançar cotação'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="mb-3 font-bold tracking-tight text-gray-900">Valores vigentes</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : latest.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma cotação registrada. Lance um valor acima para as telas que dependem de
            cotação saírem do zero.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {latest.map((q) => (
              <li
                key={`${q.commodity}::${q.state ?? ''}`}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">
                    {commodityLabel(q.commodity)}
                    {q.state ? ` · ${q.state}` : ''}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {new Date(q.recordedAt).toLocaleString('pt-BR')}
                    {q.source ? ` · ${q.source}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums text-gray-900">
                    {q.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    <span className="ml-1 text-xs font-normal text-gray-400">/{q.unit}</span>
                  </span>
                  {q.changePercent !== 0 && (
                    <span
                      className={`block text-xs font-medium tabular-nums ${
                        q.changePercent > 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {q.changePercent > 0 ? '+' : ''}
                      {q.changePercent.toLocaleString('pt-BR', {
                        maximumFractionDigits: 2,
                      })}
                      %
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
