import type { Category, RecurringRule } from '@prisma/client';
import { prisma } from '../lib/prisma';

export type RecurringDTO = {
  id: string;
  wallet_id: string;
  wallet_name: string;
  bank_name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: { id: string; name: string; icon: string } | null;
  note: string | null;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  day_of_month: number | null;
  day_of_week: number | null;
  next_run: string;
  is_active: boolean;
  created_at: Date;
};

type RuleWithRelations = RecurringRule & {
  wallet: { name: string; bank: { name: string } };
  category: Category | null;
};

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDTO(rule: RuleWithRelations): RecurringDTO {
  return {
    id: rule.id,
    wallet_id: rule.wallet_id,
    wallet_name: rule.wallet.name,
    bank_name: rule.wallet.bank.name,
    type: rule.type,
    amount: rule.amount.toNumber(),
    category: rule.category
      ? { id: rule.category.id, name: rule.category.name, icon: rule.category.icon }
      : null,
    note: rule.note,
    frequency: rule.frequency,
    day_of_month: rule.day_of_month,
    day_of_week: rule.day_of_week,
    next_run: toDateString(rule.next_run),
    is_active: rule.is_active,
    created_at: rule.created_at,
  };
}

export async function listRecurring(userId: string): Promise<{ recurring: RecurringDTO[] }> {
  const rules = await prisma.recurringRule.findMany({
    where: { user_id: userId, is_active: true },
    orderBy: { created_at: 'asc' },
    include: { wallet: { include: { bank: true } }, category: true },
  });
  return { recurring: rules.map(toDTO) };
}
