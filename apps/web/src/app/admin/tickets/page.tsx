'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Ticket, TicketPriority, TicketStatus } from '@/lib/types';

const STATUS_OPTIONS: { value: TicketStatus | 'TODOS'; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ABERTO', label: 'Aberto' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'RESOLVIDO', label: 'Resolvido' },
  { value: 'FECHADO', label: 'Fechado' },
];

const STATUS_LABEL: Record<TicketStatus, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
};

const STATUS_BADGE: Record<TicketStatus, string> = {
  ABERTO: 'bg-amber-50 text-amber-700',
  EM_ANDAMENTO: 'bg-blue-50 text-blue-700',
  RESOLVIDO: 'bg-emerald-50 text-emerald-700',
  FECHADO: 'bg-gray-100 text-gray-600',
};

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
};

const PRIORITY_BADGE: Record<TicketPriority, string> = {
  BAIXA: 'bg-gray-100 text-gray-600',
  MEDIA: 'bg-amber-50 text-amber-700',
  ALTA: 'bg-red-50 text-red-700',
};

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} dia(s)`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function AdminTicketsPage() {
  const { accessToken } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'TODOS'>('TODOS');

  const loadTickets = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Ticket[]>('/admin/tickets', { token: accessToken });
      setAllTickets(data);
      setTickets(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar tickets');
    } finally {
      setFetching(false);
    }
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTickets();
  }, [loadTickets]);

  const filtered =
    statusFilter === 'TODOS' ? tickets : tickets.filter((t) => t.status === statusFilter);

  const countByStatus = (status: TicketStatus | 'TODOS') =>
    status === 'TODOS' ? allTickets.length : allTickets.filter((t) => t.status === status).length;

  return (
    <main className="animate-fade-up mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tickets de suporte</h1>
        <p className="text-sm text-gray-500">Tickets de todas as contas da plataforma.</p>
      </header>

      {/* Chips de status com contadores */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const active = statusFilter === opt.value;
          const count = countByStatus(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
                active
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
              }`}
            >
              {opt.label}
              <span
                className={`rounded-full px-1.5 text-xs font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {fetching ? (
        <p className="text-gray-500">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-lg font-medium text-gray-700">Nenhum ticket encontrado</p>
          <p className="mt-1 text-sm text-gray-500">
            {statusFilter === 'TODOS'
              ? 'Quando os clientes abrirem tickets, eles aparecem aqui.'
              : 'Nenhum ticket com esse status.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/admin/tickets/${ticket.id}`}
              className="block rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm transition-shadow duration-150 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{ticket.subject}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {ticket.account.name} · atualizado {relativeTime(ticket.updatedAt)}
                    {ticket.messages?.length ? ` · ${ticket.messages.length} mensagem(ns)` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[ticket.priority]}`}
                  >
                    {PRIORITY_LABEL[ticket.priority]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[ticket.status]}`}
                  >
                    {STATUS_LABEL[ticket.status]}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
