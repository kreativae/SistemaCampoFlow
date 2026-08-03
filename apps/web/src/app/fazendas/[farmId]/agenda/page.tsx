'use client';

import { Calendar } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import NewRecordButton from '@/components/NewRecordButton';
import FormModal from '@/components/FormModal';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useConfirm } from '@/lib/confirm-context';
import { toApiDate, formatDate, isSameCalendarDay } from '@/lib/dates';
import type { AgendaAlert, AgendaEvent, AgendaEventType } from '@/lib/types';

const TYPE_OPTIONS: { value: AgendaEventType; label: string }[] = [
  { value: 'VACINACAO', label: 'Vacinação' },
  { value: 'PESAGEM', label: 'Pesagem' },
  { value: 'MANEJO', label: 'Manejo' },
  { value: 'COMPRA', label: 'Compra' },
  { value: 'VENDA', label: 'Venda' },
  { value: 'OUTRO', label: 'Outro' },
];

function typeLabel(type: AgendaEventType) {
  return TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type;
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const cells: (Date | null)[] = Array(leadingBlanks).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function AgendaPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const { toastSuccess } = useToast();
  const router = useRouter();
  const confirm = useConfirm();

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  // No mobile o formulário começa fechado para não empurrar a lista.
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [alerts, setAlerts] = useState<AgendaAlert[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // O mesmo modal serve para criar e editar: null = criando.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AgendaEventType>('MANEJO');
  const [scheduledDate, setScheduledDate] = useState('');

  const [view, setView] = useState<'lista' | 'calendario'>('lista');
  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [eventsData, alertsData] = await Promise.all([
        apiFetch<AgendaEvent[]>(`/fazendas/${farmId}/agenda`, { token: accessToken }),
        apiFetch<AgendaAlert[]>(`/fazendas/${farmId}/agenda/alertas`, { token: accessToken }),
      ]);
      setEvents(eventsData);
      setAlerts(alertsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar a agenda');
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

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setType('MANEJO');
    setScheduledDate('');
  }

  function closeForm() {
    setCreatingOpen(false);
    resetForm();
  }

  function startEdit(event: AgendaEvent) {
    setEditingId(event.id);
    setTitle(event.title);
    setType(event.type);
    setScheduledDate(event.scheduledDate.slice(0, 10));
    setCreatingOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch<AgendaEvent>(
        editingId
          ? `/fazendas/${farmId}/agenda/${editingId}`
          : `/fazendas/${farmId}/agenda`,
        {
          method: editingId ? 'PATCH' : 'POST',
          token: accessToken,
          body: { title, type, scheduledDate: toApiDate(scheduledDate) },
        },
      );
      const wasEditing = editingId !== null;
      closeForm();
      await loadData();
      toastSuccess(wasEditing ? 'Agendamento atualizado.' : 'Agendamento criado.');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : editingId
            ? 'Erro ao atualizar evento'
            : 'Erro ao criar evento',
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleComplete(eventId: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/agenda/${eventId}/concluir`, {
        method: 'PATCH',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao concluir evento');
    }
  }

  async function handleDelete(event: AgendaEvent) {
    const ok = await confirm({
      title: 'Excluir evento',
      message: `Excluir o evento ${event.title}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/agenda/${event.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
      toastSuccess('Agendamento excluído.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir evento');
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
        icon={Calendar}
        title="Agenda"
        subtitle="Eventos, alertas e calendário"
        backHref={`/fazendas/${farmId}`}
        actions={
          <NewRecordButton
            label="Novo evento"
            onClick={() => {
              // Limpa o que uma edição anterior tenha deixado no formulário.
              resetForm();
              setCreatingOpen(true);
            }}
          />
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {alerts.length > 0 && (
        <div className="mb-8 rounded-xl bg-amber-50 px-4 py-3">
          <h2 className="mb-2 text-sm font-bold tracking-tight text-amber-800">
            Pendentes (próximos 7 dias ou atrasados)
          </h2>
          <ul className="space-y-1 text-sm text-amber-900">
            {alerts.map((a) => (
              <li key={a.id}>
                {typeLabel(a.type)}: {a.title} —{' '}
                {formatDate(a.scheduledDate)}
                {a.overdue ? ' (atrasado)' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {creatingOpen && (
        <FormModal
          icon={Calendar}
          title={editingId ? 'Editar evento' : 'Novo evento'}
          subtitle={
            editingId
              ? 'Altere título, tipo ou data'
              : 'Agende manejo, compra, venda ou lembrete'
          }
          onClose={closeForm}
        >
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700">Título</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AgendaEventType)}
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
          <label className="text-sm font-medium text-gray-700">Data</label>
          <input
            type="date"
            required
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div className="col-span-full flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closeForm}
            className="rounded-full bg-gray-900/5 px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={creating}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
          >
            {creating ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar evento'}
          </button>
        </div>
      </form>
        </FormModal>
      )}

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setView('lista')}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
            view === 'lista' ? 'bg-emerald-700 text-white' : 'bg-gray-900/5 text-gray-800 hover:bg-gray-900/10'
          }`}
        >
          Lista
        </button>
        <button
          type="button"
          onClick={() => setView('calendario')}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
            view === 'calendario' ? 'bg-emerald-700 text-white' : 'bg-gray-900/5 text-gray-800 hover:bg-gray-900/10'
          }`}
        >
          Calendário
        </button>
      </div>

      {view === 'calendario' && (
        <div className="mb-8 overflow-x-auto rounded-2xl border border-gray-200/70 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const prev = new Date(calendarYear, calendarMonth - 1, 1);
                setCalendarMonth(prev.getMonth());
                setCalendarYear(prev.getFullYear());
              }}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-gray-600 transition-colors duration-150 hover:bg-gray-900/10"
            >
              ← Anterior
            </button>
            <p className="font-bold tracking-tight text-gray-900">
              {new Date(calendarYear, calendarMonth, 1).toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <button
              type="button"
              onClick={() => {
                const next = new Date(calendarYear, calendarMonth + 1, 1);
                setCalendarMonth(next.getMonth());
                setCalendarYear(next.getFullYear());
              }}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-gray-600 transition-colors duration-150 hover:bg-gray-900/10"
            >
              Próximo →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
            {WEEKDAY_LABELS.map((d, i) => (
              <div key={i} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {buildCalendarGrid(calendarYear, calendarMonth).map((date, i) => {
              const dayEvents = date
                ? events.filter((e) => isSameCalendarDay(e.scheduledDate, date))
                : [];
              const isToday = date ? isSameDay(date, today) : false;
              return (
                <div
                  key={i}
                  className={`min-h-20 rounded-lg border p-1 text-xs ${
                    date ? 'border-gray-200 bg-white' : 'border-transparent'
                  } ${isToday ? 'ring-2 ring-emerald-600' : ''}`}
                >
                  {date && (
                    <>
                      <p className="mb-1 font-medium text-gray-700">{date.getDate()}</p>
                      <ul className="space-y-0.5">
                        {dayEvents.map((e) => (
                          <li
                            key={e.id}
                            title={`${typeLabel(e.type)}: ${e.title}`}
                            className={`truncate rounded-full px-1.5 font-semibold ${
                              e.completedAt
                                ? 'bg-gray-100 text-gray-500'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {e.title}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view !== 'lista' ? null : events.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-gray-100/60 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
            <Calendar className="h-6 w-6" />
          </div>
          <p className="mt-4 text-lg font-bold text-gray-900">Nenhum evento na agenda</p>
          <p className="mt-1 text-sm text-gray-500">Crie eventos para organizar vacinações, manejos e outras atividades da fazenda.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex flex-col gap-2 rounded-2xl border border-gray-200/70 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{e.title}</p>
                <p className="text-sm text-gray-500">
                  {typeLabel(e.type)} · {formatDate(e.scheduledDate)}
                  {e.completedAt ? ' · concluído' : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {!e.completedAt && (
                  <button
                    onClick={() => handleComplete(e.id)}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    Marcar como concluído
                  </button>
                )}
                <button
                  onClick={() => startEdit(e)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(e)}
                  className="text-xs font-semibold text-red-600 hover:text-red-800"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
