import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { publishEvent } from '../lib/rabbitmq';
import { computeNextAfter } from '../lib/nextRun';

type MaterializedEvent = {
  user_id: string;
  transaction_id: string;
  wallet_id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category_id: string | null;
  category_name: string | null;
  date: string;
};

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function runRecurringJob(now: Date = new Date()): Promise<{ materialized: number }> {
  const dueRules = await prisma.recurringRule.findMany({
    where: { is_active: true, next_run: { lte: now } },
    include: { category: { select: { name: true } } },
  });

  const pendingEvents: MaterializedEvent[] = [];

  for (const rule of dueRules) {
    const nextRun = computeNextAfter(rule.next_run, {
      frequency: rule.frequency,
      day_of_month: rule.day_of_month,
      day_of_week: rule.day_of_week,
    });

    const [createdTx] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          user_id: rule.user_id,
          wallet_id: rule.wallet_id,
          type: rule.type,
          amount: rule.amount,
          ...(rule.category_id !== null && { category_id: rule.category_id }),
          ...(rule.note !== null && { note: rule.note }),
          date: rule.next_run,
        },
      }),
      prisma.recurringRule.update({
        where: { id: rule.id },
        data: { next_run: nextRun },
      }),
    ]);

    pendingEvents.push({
      user_id: rule.user_id,
      transaction_id: createdTx.id,
      wallet_id: createdTx.wallet_id,
      type: createdTx.type,
      amount: createdTx.amount.toNumber(),
      category_id: createdTx.category_id,
      category_name: rule.category?.name ?? null,
      date: toDateString(createdTx.date),
    });
  }

  // Publicar tras commit: si RabbitMQ falla, la transacción ya está en DB y el cron
  // del día siguiente no la re-materializa (next_run ya avanzó).
  for (const data of pendingEvents) {
    publishEvent('transaction.created', {
      event: 'transaction.created',
      timestamp: new Date().toISOString(),
      data: { ...data, transfer_id: null },
    });
  }

  return { materialized: pendingEvents.length };
}

export function scheduleRecurringJob(): void {
  cron.schedule('0 6 * * *', () => {
    runRecurringJob().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`recurring.job failed: ${message}\n`);
    });
  });
}
