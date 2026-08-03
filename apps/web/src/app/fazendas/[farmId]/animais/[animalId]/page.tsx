'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import NewRecordButton from '@/components/NewRecordButton';
import FormModal from '@/components/FormModal';
import ShowMoreButton from '@/components/ShowMoreButton';
import { ClipboardPlus } from 'lucide-react';
import type {
  Animal,
  AnimalEvent,
  AnimalParent,
  GainSummary,
  Pasture,
  PregnancyDiagnosisResult,
  ReproductiveEvent,
  ReproductiveEventType,
  VaccinationRecord,
  WeighingRecord,
} from '@/lib/types';
import {
  ANIMAL_EVENT_TYPE_LABEL,
  ANIMAL_PERFORMANCE_LABEL,
  ANIMAL_PERFORMANCE_COLOR,
  calcAnimalAge,
} from '@/lib/types';

// Quantos itens de uma lista de registros aparecem antes do "ver outros".
const VISIBLE_RECORDS = 4;

const REPRODUCTIVE_EVENT_OPTIONS: { value: ReproductiveEventType; label: string }[] = [
  { value: 'IATF', label: 'IATF' },
  { value: 'MONTA_NATURAL', label: 'Monta natural' },
  { value: 'INSEMINACAO', label: 'Inseminação' },
  { value: 'DIAGNOSTICO_PRENHEZ', label: 'Diagnóstico de prenhez' },
  { value: 'PARTO', label: 'Parto' },
  { value: 'ABORTO', label: 'Aborto' },
];

export default function AnimalDetailPage() {
  const { farmId, animalId } = useParams<{ farmId: string; animalId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [pastures, setPastures] = useState<Pasture[]>([]);
  const [movePastureId, setMovePastureId] = useState('');
  const [savingPasture, setSavingPasture] = useState(false);
  const [weighings, setWeighings] = useState<WeighingRecord[]>([]);
  const [gainSummary, setGainSummary] = useState<GainSummary | null>(null);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [reproductiveEvents, setReproductiveEvents] = useState<ReproductiveEvent[]>([]);
  const [history, setHistory] = useState<AnimalEvent[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal único de "Novo registro": pesagem, vacinação e evento reprodutivo são as
  // três coisas que se lança rotineiramente na ficha do animal.
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordTab, setRecordTab] = useState<'PESAGEM' | 'VACINACAO' | 'REPRODUCAO'>('PESAGEM');

  const [showAllWeighings, setShowAllWeighings] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const [newWeight, setNewWeight] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  const [editingWeighingId, setEditingWeighingId] = useState<string | null>(null);
  const [editWeighingKg, setEditWeighingKg] = useState('');
  const [editWeighingDate, setEditWeighingDate] = useState('');
  const [savingWeighingEdit, setSavingWeighingEdit] = useState(false);

  const [vaccineName, setVaccineName] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [savingVaccination, setSavingVaccination] = useState(false);

  const [editingVaccinationId, setEditingVaccinationId] = useState<string | null>(
    null,
  );
  const [editVaccinationScheduledDate, setEditVaccinationScheduledDate] =
    useState('');
  const [editVaccinationAdministeredAt, setEditVaccinationAdministeredAt] =
    useState('');
  const [savingVaccinationEdit, setSavingVaccinationEdit] = useState(false);

  const [reproEventType, setReproEventType] = useState<ReproductiveEventType>('IATF');
  const [reproResult, setReproResult] = useState<PregnancyDiagnosisResult | ''>('');
  const [savingReproEvent, setSavingReproEvent] = useState(false);

  const [editingReproId, setEditingReproId] = useState<string | null>(null);
  const [editReproType, setEditReproType] = useState<ReproductiveEventType>('IATF');
  const [editReproResult, setEditReproResult] = useState<PregnancyDiagnosisResult | ''>('');
  const [editReproDate, setEditReproDate] = useState('');
  const [savingReproEdit, setSavingReproEdit] = useState(false);

  const childCount = animal?.children.length ?? 0;

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const base = `/fazendas/${farmId}/animais/${animalId}`;
      const [
        animalData,
        pasturesData,
        weighingsData,
        gainData,
        vaccinationsData,
        reproductiveEventsData,
        historyData,
      ] = await Promise.all([
        apiFetch<Animal>(base, { token: accessToken }),
        apiFetch<Pasture[]>(`/fazendas/${farmId}/pastagens`, { token: accessToken }),
        apiFetch<WeighingRecord[]>(`${base}/pesagens`, { token: accessToken }),
        apiFetch<GainSummary>(`${base}/pesagens/resumo-ganho`, { token: accessToken }),
        apiFetch<VaccinationRecord[]>(`${base}/vacinacoes`, { token: accessToken }),
        apiFetch<ReproductiveEvent[]>(`${base}/eventos-reprodutivos`, { token: accessToken }),
        apiFetch<AnimalEvent[]>(`${base}/historico`, { token: accessToken }),
      ]);
      setAnimal(animalData);
      setPastures(pasturesData);
      setMovePastureId(animalData.pastureId ?? '');
      setWeighings(weighingsData);
      setGainSummary(gainData);
      setVaccinations(vaccinationsData);
      setReproductiveEvents(reproductiveEventsData);
      setHistory(historyData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados do animal');
    } finally {
      setFetching(false);
    }
  }, [farmId, animalId, accessToken]);

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

  async function handleChangePasture(event: FormEvent) {
    event.preventDefault();
    setSavingPasture(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/mover-pasto`, {
        method: 'POST',
        token: accessToken,
        body: {
          animalIds: [animalId],
          pastureId: movePastureId || null,
        },
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao trocar o pasto do animal');
    } finally {
      setSavingPasture(false);
    }
  }

  /**
   * Vincular ou desvincular um filho é sempre um PATCH no *outro* animal: quem
   * guarda a relação é o filho, no campo pai ou mãe conforme o sexo deste.
   */
  async function updateChildLink(childId: string, parentId: string | null) {
    if (!animal) return;
    const field = animal.sex === 'MALE' ? 'fatherId' : 'motherId';
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${childId}`, {
        method: 'PATCH',
        token: accessToken,
        body: { [field]: parentId },
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar a genealogia');
    }
  }

  async function handleLinkChild(childId: string) {
    if (childId === animalId) {
      setError('Um animal não pode ser filho dele mesmo.');
      return;
    }
    // A API barra o autovínculo, mas não o ciclo curto (marcar o próprio pai
    // como filho), que deixaria a genealogia sem raiz.
    if (childId === animal?.fatherId || childId === animal?.motherId) {
      setError('Este animal já é pai ou mãe deste. Remova o vínculo antes.');
      return;
    }
    await updateChildLink(childId, animalId);
  }

  async function handleUnlinkChild(child: AnimalParent) {
    const ok = await confirm({
      title: 'Remover filho',
      message: `Desvincular ${child.earTag}${child.name ? ` — ${child.name}` : ''} da genealogia deste animal? O animal continua cadastrado.`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    await updateChildLink(child.id, null);
  }

  async function handleAddWeighing(event: FormEvent) {
    event.preventDefault();
    setSavingWeight(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/pesagens`, {
        method: 'POST',
        token: accessToken,
        body: { weightKg: Number(newWeight) },
      });
      setNewWeight('');
      setRecordOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar pesagem');
    } finally {
      setSavingWeight(false);
    }
  }

  function startEditWeighing(w: WeighingRecord) {
    setEditingWeighingId(w.id);
    setEditWeighingKg(String(w.weightKg));
    setEditWeighingDate(w.weighedAt.slice(0, 10));
  }

  async function handleSaveWeighingEdit(weighingId: string) {
    setSavingWeighingEdit(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/pesagens/${weighingId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          weightKg: Number(editWeighingKg),
          weighedAt: editWeighingDate
            ? new Date(editWeighingDate).toISOString()
            : undefined,
        },
      });
      setEditingWeighingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar pesagem');
    } finally {
      setSavingWeighingEdit(false);
    }
  }

  async function handleDeleteWeighing(weighingId: string) {
    const ok = await confirm({
      title: 'Excluir pesagem',
      message: 'Excluir esta pesagem? Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/pesagens/${weighingId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir pesagem');
    }
  }

  async function handleScheduleVaccination(event: FormEvent) {
    event.preventDefault();
    setSavingVaccination(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/vacinacoes`, {
        method: 'POST',
        token: accessToken,
        body: { vaccineName, scheduledDate },
      });
      setVaccineName('');
      setScheduledDate('');
      setRecordOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao agendar vacina');
    } finally {
      setSavingVaccination(false);
    }
  }

  async function handleAddReproductiveEvent(event: FormEvent) {
    event.preventDefault();
    setSavingReproEvent(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/eventos-reprodutivos`, {
        method: 'POST',
        token: accessToken,
        body: {
          type: reproEventType,
          result: reproEventType === 'DIAGNOSTICO_PRENHEZ' && reproResult ? reproResult : undefined,
        },
      });
      setReproResult('');
      setRecordOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar evento reprodutivo');
    } finally {
      setSavingReproEvent(false);
    }
  }

  function startEditReproEvent(e: ReproductiveEvent) {
    setEditingReproId(e.id);
    setEditReproType(e.type);
    setEditReproResult(e.result ?? '');
    setEditReproDate(e.eventDate.slice(0, 10));
  }

  async function handleSaveReproEdit(eventId: string) {
    setSavingReproEdit(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/eventos-reprodutivos/${eventId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          type: editReproType,
          result: editReproType === 'DIAGNOSTICO_PRENHEZ' && editReproResult ? editReproResult : undefined,
          eventDate: editReproDate
            ? new Date(editReproDate).toISOString()
            : undefined,
        },
      });
      setEditingReproId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar evento reprodutivo');
    } finally {
      setSavingReproEdit(false);
    }
  }

  async function handleDeleteReproEvent(eventId: string) {
    const ok = await confirm({
      title: 'Excluir evento reprodutivo',
      message: 'Excluir este evento reprodutivo? Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/eventos-reprodutivos/${eventId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir evento reprodutivo');
    }
  }

  async function handleApplyVaccination(vaccinationId: string) {
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/animais/${animalId}/vacinacoes/${vaccinationId}/aplicar`,
        { method: 'PATCH', token: accessToken, body: {} },
      );
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao confirmar vacina');
    }
  }

  function startEditVaccination(v: VaccinationRecord) {
    setEditingVaccinationId(v.id);
    setEditVaccinationScheduledDate(v.scheduledDate.slice(0, 10));
    setEditVaccinationAdministeredAt(
      v.administeredAt ? v.administeredAt.slice(0, 10) : '',
    );
  }

  async function handleSaveVaccinationEdit(vaccinationId: string) {
    setSavingVaccinationEdit(true);
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/animais/${animalId}/vacinacoes/${vaccinationId}`,
        {
          method: 'PATCH',
          token: accessToken,
          body: {
            scheduledDate: editVaccinationScheduledDate
              ? new Date(editVaccinationScheduledDate).toISOString()
              : undefined,
            administeredAt: editVaccinationAdministeredAt
              ? new Date(editVaccinationAdministeredAt).toISOString()
              : undefined,
          },
        },
      );
      setEditingVaccinationId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar vacina');
    } finally {
      setSavingVaccinationEdit(false);
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
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
        <Link href={`/fazendas/${farmId}/animais`} className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
          ← Rebanho
        </Link>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-gray-900">{animal?.earTag}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span>{animal?.category} · {animal?.sex === 'FEMALE' ? 'Fêmea' : 'Macho'} · {animal?.breed ?? 'Raça não informada'}</span>
          {animal?.performance && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ANIMAL_PERFORMANCE_COLOR[animal.performance]}`}>
              {ANIMAL_PERFORMANCE_LABEL[animal.performance]}
            </span>
          )}
          {animal && (() => { const age = calcAnimalAge(animal); return age ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-semibold">
              {age.label} · {age.category}
            </span>
          ) : null; })()}
        </div>
        </div>
        <NewRecordButton label="Novo registro" onClick={() => setRecordOpen(true)} />
      </header>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard label="Peso atual" value={`${animal?.currentWeightKg ?? '—'} kg`} />
        <SummaryCard
          label="Ganho diário médio"
          value={`${gainSummary?.averageDailyGainKg ?? 0} kg`}
        />
        <SummaryCard
          label="Ganho mensal médio"
          value={`${gainSummary?.averageMonthlyGainKg ?? 0} kg`}
        />
      </section>

      {/* Coluna principal (evolução + registros) à esquerda; ficha do animal à direita. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">

      <section className="rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="mb-3 font-bold tracking-tight text-gray-900">Evolução de peso</h2>
        {weighings.length < 2 ? (
          <p className="rounded-2xl bg-gray-100/60 px-6 py-14 text-center text-sm text-gray-500">
            Registre ao menos duas pesagens para ver a curva de ganho.
          </p>
        ) : (
          <WeightEvolutionChart weighings={weighings} />
        )}
      </section>

      <section className="rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="mb-3 font-bold tracking-tight text-gray-900">Pesagens</h2>
        {weighings.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma pesagem registrada.</p>
        ) : (
          <>
            <ul className="space-y-1 text-sm text-gray-700">
              {weighings
                .slice()
                .reverse()
                .slice(0, showAllWeighings ? undefined : VISIBLE_RECORDS)
                .map((w) =>
                  editingWeighingId === w.id ? (
                    <li key={w.id} className="flex flex-wrap items-center gap-2 py-1">
                      <input
                        type="date"
                        value={editWeighingDate}
                        onChange={(e) => setEditWeighingDate(e.target.value)}
                        className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={editWeighingKg}
                        onChange={(e) => setEditWeighingKg(e.target.value)}
                        className="w-24 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                      <button
                        type="button"
                        disabled={savingWeighingEdit}
                        onClick={() => handleSaveWeighingEdit(w.id)}
                        className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
                      >
                        {savingWeighingEdit ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingWeighingId(null)}
                        className="rounded-full bg-gray-900/5 px-4 py-2 text-xs font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
                      >
                        Cancelar
                      </button>
                    </li>
                  ) : (
                    <li key={w.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        {new Date(w.weighedAt).toLocaleDateString('pt-BR')} —{' '}
                        {w.weightKg} kg
                      </span>
                      <span className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditWeighing(w)}
                          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWeighing(w.id)}
                          className="text-sm font-semibold text-red-600 hover:text-red-800"
                        >
                          Excluir
                        </button>
                      </span>
                    </li>
                  ),
                )}
            </ul>
            <ShowMoreButton
              expanded={showAllWeighings}
              hiddenCount={weighings.length - VISIBLE_RECORDS}
              onToggle={() => setShowAllWeighings((v) => !v)}
              noun="pesagens"
              feminine
            />
          </>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="mb-3 font-bold tracking-tight text-gray-900">Vacinação</h2>
        {vaccinations.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma vacina agendada.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {vaccinations.map((v) =>
              editingVaccinationId === v.id ? (
                <li key={v.id} className="flex flex-wrap items-center gap-2 py-1">
                  <span className="font-medium">{v.vaccineName}</span>
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    Agendada para
                    <input
                      type="date"
                      value={editVaccinationScheduledDate}
                      onChange={(e) => setEditVaccinationScheduledDate(e.target.value)}
                      className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </label>
                  {v.administeredAt && (
                    <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                      Aplicada em
                      <input
                        type="date"
                        value={editVaccinationAdministeredAt}
                        onChange={(e) =>
                          setEditVaccinationAdministeredAt(e.target.value)
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={savingVaccinationEdit}
                    onClick={() => handleSaveVaccinationEdit(v.id)}
                    className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
                  >
                    {savingVaccinationEdit ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingVaccinationId(null)}
                    className="rounded-full bg-gray-900/5 px-4 py-2 text-xs font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
                  >
                    Cancelar
                  </button>
                </li>
              ) : (
                <li key={v.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {v.vaccineName} — {new Date(v.scheduledDate).toLocaleDateString('pt-BR')}
                    {v.administeredAt ? ' (aplicada)' : ' (pendente)'}
                  </span>
                  <span className="flex gap-2">
                    {!v.administeredAt && (
                      <button
                        type="button"
                        onClick={() => handleApplyVaccination(v.id)}
                        className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                      >
                        Marcar como aplicada
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEditVaccination(v)}
                      className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      Editar
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="mb-3 font-bold tracking-tight text-gray-900">Reprodução</h2>
        {reproductiveEvents.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento reprodutivo registrado.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {reproductiveEvents.map((e) =>
              editingReproId === e.id ? (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-1">
                  <input
                    type="date"
                    value={editReproDate}
                    onChange={(ev) => setEditReproDate(ev.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  <select
                    value={editReproType}
                    onChange={(ev) => setEditReproType(ev.target.value as ReproductiveEventType)}
                    className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {REPRODUCTIVE_EVENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {editReproType === 'DIAGNOSTICO_PRENHEZ' && (
                    <select
                      value={editReproResult}
                      onChange={(ev) => setEditReproResult(ev.target.value as PregnancyDiagnosisResult | '')}
                      className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">Resultado...</option>
                      <option value="PRENHE">Prenhe</option>
                      <option value="VAZIA">Vazia</option>
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={savingReproEdit}
                    onClick={() => handleSaveReproEdit(e.id)}
                    className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
                  >
                    {savingReproEdit ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingReproId(null)}
                    className="rounded-full bg-gray-900/5 px-4 py-2 text-xs font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
                  >
                    Cancelar
                  </button>
                </li>
              ) : (
                <li key={e.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {new Date(e.eventDate).toLocaleDateString('pt-BR')} —{' '}
                    {REPRODUCTIVE_EVENT_OPTIONS.find((opt) => opt.value === e.type)?.label ?? e.type}
                    {e.result ? ` (${e.result === 'PRENHE' ? 'Prenhe' : 'Vazia'})` : ''}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditReproEvent(e)}
                      className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteReproEvent(e.id)}
                      className="text-sm font-semibold text-red-600 hover:text-red-800"
                    >
                      Excluir
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="mb-3 font-bold tracking-tight text-gray-900">Histórico</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento registrado.</p>
        ) : (
          <>
            <ul className="space-y-1 text-sm text-gray-700">
              {history
                .slice(0, showAllHistory ? undefined : VISIBLE_RECORDS)
                .map((e) => (
                  <li key={e.id}>
                    {new Date(e.occurredAt).toLocaleDateString('pt-BR')} —{' '}
                    {ANIMAL_EVENT_TYPE_LABEL[e.type] ?? e.type}
                    {e.description ? `: ${e.description}` : ''}
                  </li>
                ))}
            </ul>
            <ShowMoreButton
              expanded={showAllHistory}
              hiddenCount={history.length - VISIBLE_RECORDS}
              onToggle={() => setShowAllHistory((v) => !v)}
              noun="eventos"
            />
          </>
        )}
      </section>

        </div>

        <div className="flex flex-col gap-6">

      <section className="rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="mb-3 font-bold tracking-tight text-gray-900">Datas</h2>
        {/* Duas colunas só até lg: a partir daí a seção vira a barra lateral estreita,
            onde dois campos de data lado a lado cortam o ano. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de nascimento</label>
            <input
              type="date"
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              value={animal?.birthDate ? animal.birthDate.slice(0, 10) : ''}
              onChange={async (e) => {
                const v = e.target.value;
                try {
                  const updated = await apiFetch<Animal>(`/fazendas/${farmId}/animais/${animalId}`, {
                    method: 'PATCH',
                    token: accessToken,
                    body: { birthDate: v || undefined },
                  });
                  setAnimal(updated);
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : 'Erro ao atualizar data');
                }
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de entrada</label>
            <input
              type="date"
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              value={animal?.entryDate ? animal.entryDate.slice(0, 10) : ''}
              onChange={async (e) => {
                const v = e.target.value;
                try {
                  const updated = await apiFetch<Animal>(`/fazendas/${farmId}/animais/${animalId}`, {
                    method: 'PATCH',
                    token: accessToken,
                    body: { entryDate: v || undefined },
                  });
                  setAnimal(updated);
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : 'Erro ao atualizar data');
                }
              }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="mb-3 font-bold tracking-tight text-gray-900">Pasto</h2>
        <p className="mb-3 text-sm text-gray-500">
          Pasto atual:{' '}
          <span className="font-medium text-gray-800">
            {pastures.find((p) => p.id === animal?.pastureId)?.name ?? 'Sem pasto'}
          </span>
        </p>
        <form onSubmit={handleChangePasture} className="flex flex-wrap gap-2">
          <select
            value={movePastureId}
            onChange={(e) => setMovePastureId(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">— Sem pasto —</option>
            {pastures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={savingPasture || movePastureId === (animal?.pastureId ?? '')}
            className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
          >
            {savingPasture ? 'Salvando...' : 'Trocar pasto'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="mb-3 font-bold tracking-tight text-gray-900">Desempenho</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={animal?.performance ?? ''}
            onChange={async (e) => {
              const val = e.target.value || null;
              try {
                await apiFetch(`/fazendas/${farmId}/animais/${animalId}`, {
                  method: 'PATCH',
                  token: accessToken,
                  body: { performance: val },
                });
                await loadData();
              } catch {}
            }}
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">— Sem classificação —</option>
            <option value="CABECEIRA">Cabeceira (melhor)</option>
            <option value="MEIO">Meio</option>
            <option value="FUNDO">Fundo (pior)</option>
          </select>
          <p className="text-xs text-gray-500">Classificação de rendimento de engorda</p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="mb-3 font-bold tracking-tight text-gray-900">Genealogia</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-1">Pai</p>
            {animal?.father ? (
              <Link href={`/fazendas/${farmId}/animais/${animal.father.id}`} className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
                {animal.father.earTag}{animal.father.name ? ` — ${animal.father.name}` : ''}
              </Link>
            ) : (
              <AnimalSearch
                farmId={farmId}
                sex="MALE"
                label="Buscar pai..."
                token={accessToken}
                onSelect={async (id) => {
                  await apiFetch(`/fazendas/${farmId}/animais/${animalId}`, {
                    method: 'PATCH', token: accessToken, body: { fatherId: id },
                  });
                  await loadData();
                }}
              />
            )}
            {animal?.father && (
              <button
                onClick={async () => {
                  await apiFetch(`/fazendas/${farmId}/animais/${animalId}`, {
                    method: 'PATCH', token: accessToken, body: { fatherId: null },
                  });
                  await loadData();
                }}
                className="mt-1 text-sm font-semibold text-red-600 hover:text-red-800"
              >
                Remover pai
              </button>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-1">Mãe</p>
            {animal?.mother ? (
              <Link href={`/fazendas/${farmId}/animais/${animal.mother.id}`} className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
                {animal.mother.earTag}{animal.mother.name ? ` — ${animal.mother.name}` : ''}
              </Link>
            ) : (
              <AnimalSearch
                farmId={farmId}
                sex="FEMALE"
                label="Buscar mãe..."
                token={accessToken}
                onSelect={async (id) => {
                  await apiFetch(`/fazendas/${farmId}/animais/${animalId}`, {
                    method: 'PATCH', token: accessToken, body: { motherId: id },
                  });
                  await loadData();
                }}
              />
            )}
            {animal?.mother && (
              <button
                onClick={async () => {
                  await apiFetch(`/fazendas/${farmId}/animais/${animalId}`, {
                    method: 'PATCH', token: accessToken, body: { motherId: null },
                  });
                  await loadData();
                }}
                className="mt-1 text-sm font-semibold text-red-600 hover:text-red-800"
              >
                Remover mãe
              </button>
            )}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-1">
            Filhos{childCount > 0 ? ` (${childCount})` : ''}
          </p>
          {childCount > 0 ? (
            <ul className="mb-2 space-y-1">
              {animal?.children.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <Link href={`/fazendas/${farmId}/animais/${c.id}`} className="min-w-0 truncate text-sm font-semibold text-emerald-700 hover:text-emerald-900">
                    {c.earTag}{c.name ? ` — ${c.name}` : ''}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleUnlinkChild(c)}
                    className="shrink-0 text-sm font-semibold text-red-600 hover:text-red-800"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-sm text-gray-500">Nenhum filho registrado.</p>
          )}
          {/* A relação mora no filho: vincular é gravar este animal como pai ou
              mãe dele, conforme o sexo — daí o PATCH ser no outro animal. */}
          <AnimalSearch
            farmId={farmId}
            label="Buscar filho..."
            token={accessToken}
            onSelect={handleLinkChild}
          />
        </div>
      </section>

        </div>
      </div>

      {recordOpen && (
        <FormModal
          icon={ClipboardPlus}
          title="Novo registro"
          subtitle={`Animal ${animal?.earTag ?? ''}`}
          onClose={() => setRecordOpen(false)}
        >
          <div className="mb-5 flex gap-1 rounded-full bg-gray-900/5 p-1">
            {([
              ['PESAGEM', 'Pesagem'],
              ['VACINACAO', 'Vacinação'],
              ['REPRODUCAO', 'Reprodução'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRecordTab(value)}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                  recordTab === value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {recordTab === 'PESAGEM' && (
            <form onSubmit={handleAddWeighing} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  autoFocus
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRecordOpen(false)}
                  className="rounded-full bg-gray-900/5 px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingWeight}
                  className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
                >
                  {savingWeight ? 'Salvando...' : 'Registrar pesagem'}
                </button>
              </div>
            </form>
          )}

          {recordTab === 'VACINACAO' && (
            <form onSubmit={handleScheduleVaccination} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Vacina</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={vaccineName}
                    onChange={(e) => setVaccineName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Agendada para</label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRecordOpen(false)}
                  className="rounded-full bg-gray-900/5 px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingVaccination}
                  className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
                >
                  {savingVaccination ? 'Salvando...' : 'Agendar vacina'}
                </button>
              </div>
            </form>
          )}

          {recordTab === 'REPRODUCAO' && (
            <form onSubmit={handleAddReproductiveEvent} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Evento</label>
                  <select
                    value={reproEventType}
                    onChange={(e) => setReproEventType(e.target.value as ReproductiveEventType)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
                  >
                    {REPRODUCTIVE_EVENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {reproEventType === 'DIAGNOSTICO_PRENHEZ' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Resultado</label>
                    <select
                      value={reproResult}
                      onChange={(e) => setReproResult(e.target.value as PregnancyDiagnosisResult | '')}
                      required
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
                    >
                      <option value="">Selecione...</option>
                      <option value="PRENHE">Prenhe</option>
                      <option value="VAZIA">Vazia</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRecordOpen(false)}
                  className="rounded-full bg-gray-900/5 px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingReproEvent}
                  className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
                >
                  {savingReproEvent ? 'Salvando...' : 'Registrar evento'}
                </button>
              </div>
            </form>
          )}
        </FormModal>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-4 sm:p-5">
      <p className="text-[13px] font-medium text-gray-500">{label}</p>
      {/* Card estreito no mobile: o número reduz para não quebrar em duas linhas. */}
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-gray-900 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

function WeightEvolutionChart({ weighings }: { weighings: WeighingRecord[] }) {
  if (weighings.length < 2) {
    return (
      <p className="mb-4 text-sm text-gray-500">
        É preciso de pelo menos 2 pesagens para o gráfico de evolução.
      </p>
    );
  }

  const points = weighings
    .slice()
    .sort((a, b) => new Date(a.weighedAt).getTime() - new Date(b.weighedAt).getTime());

  const width = 600;
  const height = 200;
  const padding = 28;
  const weights = points.map((p) => p.weightKg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = maxWeight - minWeight || 1;

  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * (width - padding * 2);
    const y =
      height - padding - ((p.weightKg - minWeight) / range) * (height - padding * 2);
    return { x, y, ...p };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mb-4 w-full"
      role="img"
      aria-label="Evolução de peso"
    >
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#e5e7eb"
      />
      <path d={path} fill="none" stroke="#15803d" strokeWidth={2} />
      {coords.map((c) => (
        <circle key={c.id} cx={c.x} cy={c.y} r={3} fill="#15803d" />
      ))}
      {coords.map((c, i) => {
        if (i === 0) return null;
        const prev = coords[i - 1];
        const delta = c.weightKg - prev.weightKg;
        const mx = (prev.x + c.x) / 2;
        const my = Math.min(prev.y, c.y) - 8;
        return (
          <text
            key={`delta-${c.id}`}
            x={mx}
            y={my}
            fontSize={7}
            fill={delta >= 0 ? '#16a34a' : '#dc2626'}
            textAnchor="middle"
            fontWeight="bold"
          >
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)} kg
          </text>
        );
      })}
      <text x={padding} y={14} fontSize={8} fill="#6b7280">
        {maxWeight.toFixed(1)} kg
      </text>
      <text x={padding} y={height - padding + 12} fontSize={8} fill="#6b7280">
        {minWeight.toFixed(1)} kg
      </text>
      <text x={coords[0].x} y={height - 6} fontSize={7} fill="#9ca3af">
        {new Date(coords[0].weighedAt).toLocaleDateString('pt-BR')}
      </text>
      <text
        x={coords[coords.length - 1].x}
        y={height - 6}
        fontSize={7}
        fill="#9ca3af"
        textAnchor="end"
      >
        {new Date(coords[coords.length - 1].weighedAt).toLocaleDateString('pt-BR')}
      </text>
    </svg>
  );
}

/**
 * Busca um animal da propriedade para vincular na genealogia.
 *
 * `sex` restringe o resultado ao procurar pai (MALE) ou mãe (FEMALE). Ao
 * procurar filhos fica indefinido: cria e novilha entram igualmente.
 */
function AnimalSearch({
  farmId,
  sex,
  label,
  token,
  onSelect,
}: {
  farmId: string;
  sex?: 'MALE' | 'FEMALE';
  label: string;
  token: string | null;
  onSelect: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AnimalParent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const data = await apiFetch<AnimalParent[]>(
          `/fazendas/${farmId}/animais/busca?q=${encodeURIComponent(query)}${sex ? `&sexo=${sex}` : ''}`,
          { token },
        );
        setResults(data);
        setOpen(true);
      } catch {}
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, farmId, sex, token]);

  return (
    <div className="relative">
      <input
        type="text"
        placeholder={label}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-emerald-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={async () => {
                  setOpen(false);
                  setQuery('');
                  await onSelect(r.id);
                }}
              >
                {r.earTag}{r.name ? ` — ${r.name}` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
