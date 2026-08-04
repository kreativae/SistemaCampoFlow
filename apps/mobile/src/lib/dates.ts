/**
 * Datas de calendário (plantio, pesagem, agendamento) versus instantes.
 *
 * Espelha apps/web/src/lib/dates.ts — as duas pontas gravam no mesmo banco e
 * precisam concordar sobre o que é "o dia 20".
 *
 * Um campo de data devolve só "2026-08-20". Mandar essa string crua para a API
 * vira `new Date('2026-08-20')` = meia-noite UTC, que em Brasília (UTC-3) é o
 * dia 19 às 21h — o registro aparece sempre um dia antes do que o usuário
 * digitou.
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
  return `${value.trim()}${NOON_UTC}`;
}

/** Como toApiDate, mas mantém null para campos que a API usa para limpar o valor. */
export function toApiDateOrNull(value: string): string | null {
  return value ? `${value.trim()}${NOON_UTC}` : null;
}

/** ISO da API → "20/08/2026", sem deslocamento de fuso. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/**
 * Dia de calendário de um Date local, como "2026-08-20".
 *
 * Diferente de `toISOString().slice(0, 10)`, que projeta para UTC e vira o dia
 * seguinte a partir das 21h em Brasília.
 */
export function toLocalDateKey(date: Date): string {
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mes}-${dia}`;
}

/** Hoje no calendário do usuário, como "2026-08-20". */
export function todayInput(): string {
  return toLocalDateKey(new Date());
}

/** Data da API → "2026-08-20", pronta para preencher um campo de data. */
export function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
