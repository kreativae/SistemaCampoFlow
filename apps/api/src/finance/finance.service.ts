import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

type Granularity = 'daily' | 'weekly' | 'monthly';

export type BalancePeriod = 'dia' | 'semana' | 'mes' | 'semestre' | 'ano';

export const BALANCE_PERIODS: BalancePeriod[] = [
  'dia',
  'semana',
  'mes',
  'semestre',
  'ano',
];

export interface PeriodBalance {
  receita: number;
  despesa: number;
  saldo: number;
}

// O Brasil não observa horário de verão desde 2019, então o deslocamento é fixo.
// Sem isso, "saldo do dia" viraria no fim da tarde (quando o dia UTC muda), o que
// o produtor enxergaria como erro.
const BR_UTC_OFFSET_MS = -3 * 60 * 60 * 1000;

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  create(farmId: string, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        ...dto,
        farmId,
        dueDate: new Date(dto.dueDate),
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
      },
    });
  }

  findAll(farmId: string) {
    return this.prisma.transaction.findMany({
      where: { farmId },
      orderBy: { dueDate: 'desc' },
    });
  }

  async findOne(farmId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction || transaction.farmId !== farmId) {
      throw new NotFoundException('Lançamento não encontrado');
    }
    return transaction;
  }

  async update(
    farmId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ) {
    await this.findOne(farmId, transactionId);
    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
      },
    });
  }

  async markPaid(farmId: string, transactionId: string) {
    await this.findOne(farmId, transactionId);
    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { paidAt: new Date() },
    });
  }

  async markUnpaid(farmId: string, transactionId: string) {
    await this.findOne(farmId, transactionId);
    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { paidAt: null },
    });
  }

  async remove(farmId: string, transactionId: string) {
    await this.findOne(farmId, transactionId);
    await this.prisma.transaction.delete({ where: { id: transactionId } });
    return { success: true };
  }

  // Aggregates revenue/expense/balance per period bucket (daily/weekly/monthly),
  // using the paid date when available, falling back to the due date otherwise.
  async cashFlow(farmId: string, granularity: Granularity = 'monthly') {
    const transactions = await this.prisma.transaction.findMany({
      where: { farmId },
    });

    const buckets = new Map<string, { receita: number; despesa: number }>();
    for (const transaction of transactions) {
      const key = this.bucketKey(
        transaction.paidAt ?? transaction.dueDate,
        granularity,
      );
      const bucket = buckets.get(key) ?? { receita: 0, despesa: 0 };
      if (transaction.type === TransactionType.RECEITA) {
        bucket.receita += transaction.amount;
      } else {
        bucket.despesa += transaction.amount;
      }
      buckets.set(key, bucket);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, { receita, despesa }]) => ({
        period,
        receita,
        despesa,
        saldo: receita - despesa,
      }));
  }

  // Receita/despesa/saldo do período CORRENTE, para os cinco recortes que o painel
  // oferece. Devolve todos de uma vez porque a troca no card é instantânea e o
  // custo é o mesmo: a varredura das transações já acontece uma única vez.
  async periodBalances(farmId: string): Promise<Record<BalancePeriod, PeriodBalance>> {
    const transactions = await this.prisma.transaction.findMany({
      where: { farmId },
      select: { type: true, amount: true, paidAt: true, dueDate: true },
    });

    const starts = this.periodStarts(new Date());
    const result = {} as Record<BalancePeriod, PeriodBalance>;
    for (const period of BALANCE_PERIODS) {
      result[period] = { receita: 0, despesa: 0, saldo: 0 };
    }

    for (const transaction of transactions) {
      const date = transaction.paidAt ?? transaction.dueDate;
      for (const period of BALANCE_PERIODS) {
        if (date < starts[period]) continue;
        const bucket = result[period];
        if (transaction.type === TransactionType.RECEITA) {
          bucket.receita += transaction.amount;
        } else {
          bucket.despesa += transaction.amount;
        }
      }
    }

    for (const period of BALANCE_PERIODS) {
      const bucket = result[period];
      bucket.saldo = bucket.receita - bucket.despesa;
    }

    return result;
  }

  // Início de cada período corrente, em horário de Brasília, devolvido como
  // instante UTC para comparar direto com as datas do banco.
  private periodStarts(now: Date): Record<BalancePeriod, Date> {
    const brNow = new Date(now.getTime() + BR_UTC_OFFSET_MS);
    const year = brNow.getUTCFullYear();
    const month = brNow.getUTCMonth();
    const day = brNow.getUTCDate();

    // Semana começa na segunda-feira, mesma convenção do weekKey().
    const weekday = brNow.getUTCDay() || 7;

    const toUtc = (y: number, m: number, d: number) =>
      new Date(Date.UTC(y, m, d) - BR_UTC_OFFSET_MS);

    return {
      dia: toUtc(year, month, day),
      semana: toUtc(year, month, day - (weekday - 1)),
      mes: toUtc(year, month, 1),
      semestre: toUtc(year, month < 6 ? 0 : 6, 1),
      ano: toUtc(year, 0, 1),
    };
  }

  private bucketKey(date: Date, granularity: Granularity): string {
    if (granularity === 'daily') {
      return date.toISOString().slice(0, 10);
    }
    if (granularity === 'monthly') {
      return date.toISOString().slice(0, 7);
    }
    return this.weekKey(date);
  }

  private weekKey(date: Date): string {
    const utcDate = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNumber = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() - dayNumber + 1);
    return utcDate.toISOString().slice(0, 10);
  }
}
