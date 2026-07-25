'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, apiDownload, ApiError } from '@/lib/api';

type ReportType = 'rebanho' | 'financeiro' | 'sanidade' | 'reproducao' | 'custos';
type ReportFormat = 'csv' | 'xlsx' | 'pdf';

interface Pasture {
  id: string;
  name: string;
}

const TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'rebanho', label: 'Rebanho' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'sanidade', label: 'Sanidade' },
  { value: 'reproducao', label: 'Reprodução' },
  { value: 'custos', label: 'Custos' },
];

const FORMAT_OPTIONS: { value: ReportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel (XLSX)' },
  { value: 'pdf', label: 'PDF' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'BEZERRO', label: 'Bezerro' },
  { value: 'BEZERRA', label: 'Bezerra' },
  { value: 'NOVILHO', label: 'Novilho' },
  { value: 'NOVILHA', label: 'Novilha' },
  { value: 'GARROTE', label: 'Garrote' },
  { value: 'BOI', label: 'Boi' },
  { value: 'VACA', label: 'Vaca' },
  { value: 'TOURO', label: 'Touro' },
  { value: 'MATRIZ', label: 'Matriz' },
];

const SEX_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'MALE', label: 'Macho' },
  { value: 'FEMALE', label: 'Fêmea' },
];

const PERFORMANCE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'CABECEIRA', label: 'Cabeceira' },
  { value: 'MEIO', label: 'Meio' },
  { value: 'FUNDO', label: 'Fundo' },
];

const REPRO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'COM_EVENTO', label: 'Com evento reprodutivo' },
  { value: 'SEM_EVENTO', label: 'Sem evento reprodutivo' },
  { value: 'PRENHE', label: 'Prenhe (diagnóstico positivo)' },
];

const selectClasses = 'mt-1 block w-full max-w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400';

export default function ReportsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [type, setType] = useState<ReportType>('rebanho');
  const [format, setFormat] = useState<ReportFormat>('csv');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [herdBirthMonth, setHerdBirthMonth] = useState('');
  const [herdPerformance, setHerdPerformance] = useState('');
  const [herdSortByGain, setHerdSortByGain] = useState('');
  const [herdCategory, setHerdCategory] = useState('');
  const [herdSex, setHerdSex] = useState('');
  const [herdPastureId, setHerdPastureId] = useState('');
  const [herdVaccination, setHerdVaccination] = useState('');
  const [herdReproStatus, setHerdReproStatus] = useState('');
  const [herdStartDate, setHerdStartDate] = useState('');
  const [herdEndDate, setHerdEndDate] = useState('');

  const [pastures, setPastures] = useState<Pasture[]>([]);

  const loadPastures = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<Pasture[]>(`/fazendas/${farmId}/pastagens`, { token: accessToken });
      setPastures(data);
    } catch { /* ignore */ }
  }, [farmId, accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    void loadPastures();
  }, [loading, user, router, loadPastures]);

  async function handleDownload(reportType: ReportType, reportFormat: ReportFormat) {
    const key = `${reportType}-${reportFormat}`;
    setDownloading(key);
    setError(null);
    try {
      let url = `/fazendas/${farmId}/relatorios/${reportType}?format=${reportFormat}`;
      if (reportType === 'rebanho') {
        if (herdBirthMonth) url += `&birthMonth=${herdBirthMonth}`;
        if (herdPerformance) url += `&performance=${herdPerformance}`;
        if (herdSortByGain) url += `&sortByGain=${herdSortByGain}`;
        if (herdCategory) url += `&category=${herdCategory}`;
        if (herdSex) url += `&sex=${herdSex}`;
        if (herdPastureId) url += `&pastureId=${encodeURIComponent(herdPastureId)}`;
        if (herdVaccination) url += `&vaccination=${encodeURIComponent(herdVaccination)}`;
        if (herdReproStatus) url += `&reproStatus=${herdReproStatus}`;
        if (herdStartDate) url += `&startDate=${herdStartDate}`;
        if (herdEndDate) url += `&endDate=${herdEndDate}`;
      }
      await apiDownload(url, `${reportType}.${reportFormat}`, accessToken);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Erro ao gerar relatório. Verifique se seu perfil tem permissão (Proprietário/Gerente).',
      );
    } finally {
      setDownloading(null);
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
        icon={BarChart3}
        title="Relatórios"
        subtitle="Exportação de dados gerenciais"
        backHref={`/fazendas/${farmId}`}
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mb-8 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200/70 bg-white p-5">
        <div>
          <label className="text-sm font-medium text-gray-700">Relatório</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ReportType)}
            className={selectClasses}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Formato</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ReportFormat)}
            className={selectClasses}
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => handleDownload(type, format)}
          disabled={downloading === `${type}-${format}`}
          className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
        >
          {downloading === `${type}-${format}` ? 'Gerando...' : 'Baixar relatório'}
        </button>
      </div>

      {type === 'rebanho' && (
        <div className="mb-8 rounded-2xl border border-gray-200/70 bg-white p-5">
          <p className="w-full text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-3">Personalizar relatório de rebanho</p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Categoria</label>
              <select value={herdCategory} onChange={(e) => setHerdCategory(e.target.value)} className={selectClasses}>
                {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Sexo</label>
              <select value={herdSex} onChange={(e) => setHerdSex(e.target.value)} className={selectClasses}>
                {SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Pasto</label>
              <select value={herdPastureId} onChange={(e) => setHerdPastureId(e.target.value)} className={selectClasses}>
                <option value="">Todos</option>
                {pastures.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Desempenho</label>
              <select value={herdPerformance} onChange={(e) => setHerdPerformance(e.target.value)} className={selectClasses}>
                {PERFORMANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Mês de nascimento</label>
              <select value={herdBirthMonth} onChange={(e) => setHerdBirthMonth(e.target.value)} className={selectClasses}>
                <option value="">Todos</option>
                {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Vacinação</label>
              <input
                type="text"
                placeholder="Ex: Raiva, Aftosa..."
                value={herdVaccination}
                onChange={(e) => setHerdVaccination(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Reprodução</label>
              <select value={herdReproStatus} onChange={(e) => setHerdReproStatus(e.target.value)} className={selectClasses}>
                {REPRO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Ordenar por ganho</label>
              <select value={herdSortByGain} onChange={(e) => setHerdSortByGain(e.target.value)} className={selectClasses}>
                <option value="">Padrão</option>
                <option value="desc">Maior ganho primeiro</option>
                <option value="asc">Menor ganho primeiro</option>
              </select>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Período — de</label>
              <input
                type="date"
                value={herdStartDate}
                onChange={(e) => setHerdStartDate(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Período — até</label>
              <input
                type="date"
                value={herdEndDate}
                onChange={(e) => setHerdEndDate(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {TYPE_OPTIONS.map((opt) => (
          <li
            key={opt.value}
            className="flex flex-col gap-2 rounded-2xl border border-gray-200/70 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-medium text-gray-900">{opt.label}</span>
            <div className="flex flex-wrap gap-3">
              {FORMAT_OPTIONS.map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() => handleDownload(opt.value, fmt.value)}
                  disabled={downloading === `${opt.value}-${fmt.value}`}
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
                >
                  {downloading === `${opt.value}-${fmt.value}` ? '...' : fmt.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
