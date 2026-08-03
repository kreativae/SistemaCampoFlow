/**
 * Datas de calendário (plantio, colheita, agendamento) versus instantes.
 *
 * Um <input type="date"> devolve só "2026-08-20". Mandar essa string crua para a
 * API vira `new Date('2026-08-20')` = meia-noite UTC, que em Brasília (UTC-3) é o
 * dia 19 às 21h — o registro aparece sempre um dia antes do que o usuário digitou.
 *
 * A solução é tratar essas datas como o DIA, não como um instante:
 * - ao enviar, fixa meio-dia UTC, horário em que nenhum fuso do mundo cruza a
 *   virada do dia;
 * - ao exibir, formata em UTC, o que também corrige os registros gravados à
 *   meia-noite antes desta correção, sem precisar migrar o banco.
 */

const NOON_UTC = 'T12:00:00.000Z';

/** "2026-08-20" → "2026-08-20T12:00:00.000Z". Vazio vira undefined. */
export function toApiDate(value: string): string | undefined {
  if (!value) return undefined;
  return `${value}${NOON_UTC}`;
}

/** Como toApiDate, mas mantém null para campos que a API usa para limpar o valor. */
export function toApiDateOrNull(value: string): string | null {
  return value ? `${value}${NOON_UTC}` : null;
}

/** ISO da API → "20/08/2026", sem deslocamento de fuso. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** Compara o dia de uma data da API com um Date local (calendários). */
export function isSameCalendarDay(iso: string, date: Date): boolean {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === date.getFullYear() &&
    d.getUTCMonth() === date.getMonth() &&
    d.getUTCDate() === date.getDate()
  );
}
