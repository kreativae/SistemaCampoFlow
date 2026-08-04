import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Filtros de relatório.
 *
 * Todos opcionais e comuns a vários tipos — cada construtor usa o que faz
 * sentido para ele e ignora o resto. O ValidationPipe global roda com
 * `forbidNonWhitelisted`, então todo parâmetro aceito precisa estar declarado
 * aqui, inclusive `format`.
 */
export class ReportQueryDto {
  @IsOptional()
  @IsString()
  format?: string;

  // Comum a quase todos: recorte por data.
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  // Abate e negócio.
  @IsOptional()
  @IsString()
  dealId?: string;

  // Rebanho.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  birthMonth?: number;

  @IsOptional()
  @IsString()
  performance?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortByGain?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  sex?: string;

  @IsOptional()
  @IsString()
  pastureId?: string;

  @IsOptional()
  @IsString()
  vaccination?: string;

  @IsOptional()
  @IsString()
  reproStatus?: string;

  // Financeiro: RECEITA | DESPESA e situação de pagamento.
  @IsOptional()
  @IsString()
  transactionType?: string;

  @IsOptional()
  @IsIn(['pago', 'pendente'])
  paymentStatus?: 'pago' | 'pendente';

  // Sanidade: vacinação | tratamento, e se a vacina já foi aplicada.
  @IsOptional()
  @IsIn(['vacinacao', 'tratamento'])
  healthKind?: 'vacinacao' | 'tratamento';

  @IsOptional()
  @IsIn(['aplicada', 'pendente'])
  vaccinationStatus?: 'aplicada' | 'pendente';

  // Reprodução: tipo do evento e desfecho.
  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  eventResult?: string;

  // Custos: de onde veio o gasto.
  @IsOptional()
  @IsIn(['despesa', 'manutencao', 'combustivel'])
  costSource?: 'despesa' | 'manutencao' | 'combustivel';
}
