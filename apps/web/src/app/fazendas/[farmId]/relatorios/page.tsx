'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  BarChart3,
  Beef,
  ChevronLeft,
  HeartPulse,
  Receipt,
  Sprout,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import NewRecordButton from '@/components/NewRecordButton';
import FormModal from '@/components/FormModal';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, apiDownload, ApiError } from '@/lib/api';

type ReportType = 'rebanho' | 'financeiro' | 'sanidade' | 'reproducao' | 'custos';
type ReportFormat = 'csv' | 'xlsx' | 'pdf';

interface Pasture {
  id: string;
  name: string;
}

const REPORTS: {
  value: ReportType;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    value: 'rebanho',
    label: 'Rebanho',
    icon: Beef,
    description: 'Animais com peso, ganho, categoria e pasto',
  },
  {
    value: 'financeiro',
    label: 'Financeiro',
    icon: Wallet,
    description: 'Receitas e despesas com vencimento e pagamento',
  },
  {
    value: 'sanidade',
    label: 'Sanidade',
    icon: HeartPulse,
    description: 'Vacinações e tratamentos por animal',
  },
  {
    value: 'reproducao',
    label: 'Reprodução',
    icon: Sprout,
    description: 'Coberturas, diagnósticos e partos',
  },
  {
    value: 'custos',
    label: 'Custos',
    icon: Receipt,
    description: 'Despesas, manutenções e combustível',
  },
];

const FORMAT_OPTIONS: { value: ReportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel (XLSX)' },
  { value: 'pdf', label: 'PDF' },
];

const ANIMAL_CATEGORY_OPTIONS = [
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

const TRANSACTION_CATEGORY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'NUTRICAO', label: 'Nutrição' },
  { value: 'MEDICAMENTOS', label: 'Medicamentos' },
  { value: 'FUNCIONARIOS', label: 'Funcionários' },
  { value: 'COMBUSTIVEL', label: 'Combustível' },
  { value: 'MAQUINARIO', label: 'Maquinário' },
  { value: 'ENERGIA', label: 'Energia' },
  { value: 'VENDA_ANIMAL', label: 'Venda de animal' },
  { value: 'OUTROS', label: 'Outros' },
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

const REPRO_STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'COM_EVENTO', label: 'Com evento reprodutivo' },
  { value: 'SEM_EVENTO', label: 'Sem evento reprodutivo' },
  { value: 'PRENHE', label: 'Prenhe (diagnóstico positivo)' },
];

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'IATF', label: 'IATF' },
  { value: 'MONTA_NATURAL', label: 'Monta natural' },
  { value: 'INSEMINACAO', label: 'Inseminação' },
  { value: 'DIAGNOSTICO_PRENHEZ', label: 'Diagnóstico de prenhez' },
  { value: 'PARTO', label: 'Parto' },
  { value: 'ABORTO', label: 'Aborto' },
];

const MONTH_OPTIONS = [
  { value: '', label: 'Todos' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2026, i, 1).toLocaleDateString('pt-BR', { month: 'long' }),
  })),
];

/**
 * Um campo por chave de filtro. `category` aparece nos dois grupos com domínios
 * diferentes (categoria do animal x do lançamento), e é justamente por isso que
 * trocar de relatório precisa zerar os filtros — ver `selectReport`.
 */
interface Filters {
  startDate: string;
  endDate: string;
  category: string;
  sex: string;
  pastureId: string;
  performance: string;
  birthMonth: string;
  vaccination: string;
  reproStatus: string;
  sortByGain: string;
  transactionType: string;
  paymentStatus: string;
  healthKind: string;
  vaccinationStatus: string;
  eventType: string;
  eventResult: string;
  costSource: string;
}

const EMPTY_FILTERS: Filters = {
  startDate: '',
  endDate: '',
  category: '',
  sex: '',
  pastureId: '',
  performance: '',
  birthMonth: '',
  vaccination: '',
  reproStatus: '',
  sortByGain: '',
  transactionType: '',
  paymentStatus: '',
  healthKind: '',
  vaccinationStatus: '',
  eventType: '',
  eventResult: '',
  costSource: '',
};

const fieldClasses =
  'mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClasses}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export default function ReportsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  // `null` = o modal está no passo de escolher o relatório.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selected, setSelected] = useState<ReportType | null>(null);
  const [format, setFormat] = useState<ReportFormat>('csv');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastures, setPastures] = useState<Pasture[]>([]);

  const setFilter = (key: keyof Filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const loadPastures = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<Pasture[]>(`/fazendas/${farmId}/pastagens`, {
        token: accessToken,
      });
      setPastures(data);
    } catch {
      /* o filtro de pasto simplesmente não aparece */
    }
  }, [farmId, accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    void loadPastures();
  }, [loading, user, router, loadPastures]);

  function openWizard(type: ReportType | null) {
    setSelected(type);
    setFilters(EMPTY_FILTERS);
    setError(null);
    setWizardOpen(true);
  }

  // Zerar é obrigatório, não cosmético: `category` vale BOI no rebanho e
  // NUTRICAO no financeiro — levar o valor de um para o outro quebraria a consulta.
  function selectReport(type: ReportType) {
    setSelected(type);
    setFilters(EMPTY_FILTERS);
  }

  async function handleDownload() {
    if (!selected) return;
    setDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ format });
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
      await apiDownload(
        `/fazendas/${farmId}/relatorios/${selected}?${params.toString()}`,
        `${selected}.${format}`,
        accessToken,
      );
      setWizardOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Erro ao gerar relatório. Verifique se seu perfil tem permissão (Proprietário/Gerente).',
      );
    } finally {
      setDownloading(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </main>
    );
  }

  const current = REPORTS.find((r) => r.value === selected);

  return (
    <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-8">
      <PageHeader
        icon={BarChart3}
        title="Relatórios"
        subtitle="Exportação de dados gerenciais"
        backHref={`/fazendas/${farmId}`}
        actions={<NewRecordButton label="Criar relatório" onClick={() => openWizard(null)} />}
      />

      {error && !wizardOpen && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <li key={report.value}>
              <button
                type="button"
                onClick={() => openWizard(report.value)}
                className="flex w-full items-center gap-4 rounded-2xl border border-gray-200/70 bg-white p-5 text-left transition-colors duration-150 hover:border-gray-300 hover:bg-gray-50/70"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
                  <Icon size={18} strokeWidth={1.9} />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold tracking-tight text-gray-900">
                    {report.label}
                  </span>
                  <span className="block text-sm text-gray-500">{report.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {wizardOpen && (
        <FormModal
          icon={current?.icon ?? BarChart3}
          title={current ? `Relatório de ${current.label}` : 'Criar relatório'}
          subtitle={
            current
              ? 'Ajuste o recorte e escolha o formato'
              : 'Escolha o que você quer exportar'
          }
          maxWidth="max-w-2xl"
          onClose={() => setWizardOpen(false)}
        >
          {error && (
            <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
              {error}
            </p>
          )}

          {!current ? (
            <ul className="space-y-2">
              {REPORTS.map((report) => {
                const Icon = report.icon;
                return (
                  <li key={report.value}>
                    <button
                      type="button"
                      onClick={() => selectReport(report.value)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-gray-200/70 p-4 text-left transition-colors duration-150 hover:border-gray-300 hover:bg-gray-50/70"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
                        <Icon size={17} strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-gray-900">
                          {report.label}
                        </span>
                        <span className="block text-xs text-gray-500">{report.description}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="space-y-5">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="-ml-1 flex items-center gap-1 text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-900"
              >
                <ChevronLeft size={16} strokeWidth={2.2} />
                Trocar relatório
              </button>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Período — de">
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilter('startDate', e.target.value)}
                    className={fieldClasses}
                  />
                </Field>
                <Field label="Período — até">
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilter('endDate', e.target.value)}
                    className={fieldClasses}
                  />
                </Field>

                {selected === 'rebanho' && (
                  <>
                    <Select
                      label="Categoria"
                      value={filters.category}
                      options={ANIMAL_CATEGORY_OPTIONS}
                      onChange={(v) => setFilter('category', v)}
                    />
                    <Select
                      label="Sexo"
                      value={filters.sex}
                      options={SEX_OPTIONS}
                      onChange={(v) => setFilter('sex', v)}
                    />
                    <Select
                      label="Pasto"
                      value={filters.pastureId}
                      options={[
                        { value: '', label: 'Todos' },
                        ...pastures.map((p) => ({ value: p.id, label: p.name })),
                      ]}
                      onChange={(v) => setFilter('pastureId', v)}
                    />
                    <Select
                      label="Desempenho"
                      value={filters.performance}
                      options={PERFORMANCE_OPTIONS}
                      onChange={(v) => setFilter('performance', v)}
                    />
                    <Select
                      label="Mês de nascimento"
                      value={filters.birthMonth}
                      options={MONTH_OPTIONS}
                      onChange={(v) => setFilter('birthMonth', v)}
                    />
                    <Field label="Vacinação">
                      <input
                        type="text"
                        placeholder="Ex: Raiva, Aftosa..."
                        value={filters.vaccination}
                        onChange={(e) => setFilter('vaccination', e.target.value)}
                        className={fieldClasses}
                      />
                    </Field>
                    <Select
                      label="Reprodução"
                      value={filters.reproStatus}
                      options={REPRO_STATUS_OPTIONS}
                      onChange={(v) => setFilter('reproStatus', v)}
                    />
                    <Select
                      label="Ordenar por ganho"
                      value={filters.sortByGain}
                      options={[
                        { value: '', label: 'Padrão' },
                        { value: 'desc', label: 'Maior ganho primeiro' },
                        { value: 'asc', label: 'Menor ganho primeiro' },
                      ]}
                      onChange={(v) => setFilter('sortByGain', v)}
                    />
                  </>
                )}

                {selected === 'financeiro' && (
                  <>
                    <Select
                      label="Tipo"
                      value={filters.transactionType}
                      options={[
                        { value: '', label: 'Todos' },
                        { value: 'RECEITA', label: 'Receita' },
                        { value: 'DESPESA', label: 'Despesa' },
                      ]}
                      onChange={(v) => setFilter('transactionType', v)}
                    />
                    <Select
                      label="Situação"
                      value={filters.paymentStatus}
                      options={[
                        { value: '', label: 'Todas' },
                        { value: 'pago', label: 'Pago' },
                        { value: 'pendente', label: 'Pendente' },
                      ]}
                      onChange={(v) => setFilter('paymentStatus', v)}
                    />
                    <Select
                      label="Categoria"
                      value={filters.category}
                      options={TRANSACTION_CATEGORY_OPTIONS}
                      onChange={(v) => setFilter('category', v)}
                    />
                  </>
                )}

                {selected === 'sanidade' && (
                  <>
                    <Select
                      label="Tipo de registro"
                      value={filters.healthKind}
                      options={[
                        { value: '', label: 'Todos' },
                        { value: 'vacinacao', label: 'Vacinação' },
                        { value: 'tratamento', label: 'Tratamento' },
                      ]}
                      onChange={(v) => setFilter('healthKind', v)}
                    />
                    <Select
                      label="Situação da vacina"
                      value={filters.vaccinationStatus}
                      options={[
                        { value: '', label: 'Todas' },
                        { value: 'aplicada', label: 'Aplicada' },
                        { value: 'pendente', label: 'Pendente' },
                      ]}
                      onChange={(v) => setFilter('vaccinationStatus', v)}
                    />
                  </>
                )}

                {selected === 'reproducao' && (
                  <>
                    <Select
                      label="Tipo de evento"
                      value={filters.eventType}
                      options={EVENT_TYPE_OPTIONS}
                      onChange={(v) => setFilter('eventType', v)}
                    />
                    <Select
                      label="Resultado"
                      value={filters.eventResult}
                      options={[
                        { value: '', label: 'Todos' },
                        { value: 'PRENHE', label: 'Prenhe' },
                        { value: 'VAZIA', label: 'Vazia' },
                      ]}
                      onChange={(v) => setFilter('eventResult', v)}
                    />
                  </>
                )}

                {selected === 'custos' && (
                  <>
                    <Select
                      label="Origem"
                      value={filters.costSource}
                      options={[
                        { value: '', label: 'Todas' },
                        { value: 'despesa', label: 'Despesa' },
                        { value: 'manutencao', label: 'Manutenção' },
                        { value: 'combustivel', label: 'Combustível' },
                      ]}
                      onChange={(v) => setFilter('costSource', v)}
                    />
                    <Select
                      label="Categoria da despesa"
                      value={filters.category}
                      options={TRANSACTION_CATEGORY_OPTIONS}
                      onChange={(v) => setFilter('category', v)}
                    />
                  </>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="sm:w-44">
                  <Select
                    label="Formato"
                    value={format}
                    options={FORMAT_OPTIONS}
                    onChange={(v) => setFormat(v as ReportFormat)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
                >
                  {downloading ? 'Gerando...' : 'Baixar relatório'}
                </button>
              </div>
            </div>
          )}
        </FormModal>
      )}
    </main>
  );
}
