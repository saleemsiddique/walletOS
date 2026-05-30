import type { Category, RecurringRule } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { computeFirstMatch } from '../lib/nextRun';
import type { CreateRecurringInput } from '../validators/recurring.validators';

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

async function loadOwnedWallet(userId: string, walletId: string): Promise<void> {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { user_id: true },
  });
  if (!wallet || wallet.user_id !== userId) throw new NotFoundError('Wallet not found');
}

async function validateCategoryForUser(
  userId: string,
  categoryId: string,
  txType: 'INCOME' | 'EXPENSE',
): Promise<void> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { user_id: true, type: true },
  });
  if (!category || (category.user_id !== null && category.user_id !== userId)) {
    throw new ValidationError('Category not found for user');
  }
  if (category.type !== txType) {
    throw new ValidationError('Category type does not match rule type');
  }
}

export async function createRecurring(
  userId: string,
  input: CreateRecurringInput,
): Promise<RecurringDTO> {
  await loadOwnedWallet(userId, input.wallet_id);

  if (input.category_id !== undefined) {
    await validateCategoryForUser(userId, input.category_id, input.type);
  }

  const startsAt = input.starts_at !== undefined ? new Date(input.starts_at) : new Date();
  const nextRun = computeFirstMatch(startsAt, {
    frequency: input.frequency,
    day_of_month: input.day_of_month ?? null,
    day_of_week: input.day_of_week ?? null,
  });

  const created = await prisma.recurringRule.create({
    data: {
      user_id: userId,
      wallet_id: input.wallet_id,
      type: input.type,
      amount: new Decimal(input.amount),
      ...(input.category_id !== undefined && { category_id: input.category_id }),
      ...(input.note !== undefined && { note: input.note }),
      frequency: input.frequency,
      ...(input.day_of_month !== undefined && { day_of_month: input.day_of_month }),
      ...(input.day_of_week !== undefined && { day_of_week: input.day_of_week }),
      starts_at: startsAt,
      next_run: nextRun,
    },
    include: { wallet: { include: { bank: true } }, category: true },
  });
  return toDTO(created);
}
