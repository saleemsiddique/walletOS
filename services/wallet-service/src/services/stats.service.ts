import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { StatsQuery } from '../validators/stats.validators';

type CategoryBreakdownItem = {
  category_id: string | null;
  name: string;
  icon: string;
  total: number;
  pct: number;
  transaction_count: number;
};

export type StatsResponse = {
  period: { month: number; year: number };
  total_expense: number;
  total_income: number;
  previous_period: { total_expense: number; total_income: number };
  expense_change_pct: number;
  income_change_pct: number;
  by_category: CategoryBreakdownItem[];
};

function monthRange(year: number, month1: number): { from: Date; to: Date } {
  const from = new Date(Date.UTC(year, month1 - 1, 1));
  const to = new Date(Date.UTC(year, month1, 1));
  return { from, to };
}

function previousMonth(year: number, month1: number): { year: number; month: number } {
  if (month1 === 1) return { year: year - 1, month: 12 };
  return { year, month: month1 - 1 };
}

function changePct(current: Decimal, previous: Decimal): number {
  if (previous.isZero()) return 0;
  return current.sub(previous).div(previous).mul(100).toDecimalPlaces(1).toNumber();
}

async function walletIdsForBank(userId: string, bankId: string): Promise<string[]> {
  const wallets = await prisma.wallet.findMany({
    where: { user_id: userId, bank_id: bankId },
    select: { id: true },
  });
  return wallets.map((w) => w.id);
}

async function buildScopeWhere(
  userId: string,
  scope: { wallet_id?: string; bank_id?: string },
): Promise<Prisma.TransactionWhereInput> {
  if (scope.wallet_id !== undefined) {
    return { user_id: userId, wallet_id: scope.wallet_id };
  }
  if (scope.bank_id !== undefined) {
    const ids = await walletIdsForBank(userId, scope.bank_id);
    return { user_id: userId, wallet_id: { in: ids } };
  }
  return { user_id: userId };
}

async function totalsForPeriod(
  baseWhere: Prisma.TransactionWhereInput,
  from: Date,
  to: Date,
): Promise<{ expense: Decimal; income: Decimal }> {
  const rows = await prisma.transaction.groupBy({
    by: ['type'],
    where: { ...baseWhere, date: { gte: from, lt: to }, transfer_id: null },
    _sum: { amount: true },
  });
  let expense = new Decimal(0);
  let income = new Decimal(0);
  for (const r of rows) {
    const sum = r._sum.amount ?? new Decimal(0);
    if (r.type === 'EXPENSE') expense = sum;
    else income = sum;
  }
  return { expense, income };
}

async function expenseByCategory(
  baseWhere: Prisma.TransactionWhereInput,
  from: Date,
  to: Date,
  totalExpense: Decimal,
): Promise<CategoryBreakdownItem[]> {
  const rows = await prisma.transaction.groupBy({
    by: ['category_id'],
    where: {
      ...baseWhere,
      date: { gte: from, lt: to },
      transfer_id: null,
      type: 'EXPENSE',
    },
    _sum: { amount: true },
    _count: { _all: true },
  });
  if (rows.length === 0) return [];

  const categoryIds = rows
    .map((r) => r.category_id)
    .filter((id): id is string => id !== null);
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, icon: true },
  });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const items: CategoryBreakdownItem[] = rows.map((r) => {
    const cat = r.category_id !== null ? catMap.get(r.category_id) : undefined;
    const total = r._sum.amount ?? new Decimal(0);
    const pct = totalExpense.isZero()
      ? 0
      : total.div(totalExpense).mul(100).toDecimalPlaces(1).toNumber();
    return {
      category_id: r.category_id,
      name: cat?.name ?? 'Sin categoría',
      icon: cat?.icon ?? '···',
      total: total.toNumber(),
      pct,
      transaction_count: r._count._all,
    };
  });

  return items.sort((a, b) => b.total - a.total);
}

export async function getStats(userId: string, query: StatsQuery): Promise<StatsResponse> {
  const baseWhere = await buildScopeWhere(userId, {
    ...(query.wallet_id !== undefined && { wallet_id: query.wallet_id }),
    ...(query.bank_id !== undefined && { bank_id: query.bank_id }),
  });

  const current = monthRange(query.year, query.month);
  const prevPeriod = previousMonth(query.year, query.month);
  const prev = monthRange(prevPeriod.year, prevPeriod.month);

  const [currentTotals, prevTotals] = await Promise.all([
    totalsForPeriod(baseWhere, current.from, current.to),
    totalsForPeriod(baseWhere, prev.from, prev.to),
  ]);

  const byCategory = await expenseByCategory(
    baseWhere,
    current.from,
    current.to,
    currentTotals.expense,
  );

  return {
    period: { month: query.month, year: query.year },
    total_expense: currentTotals.expense.toNumber(),
    total_income: currentTotals.income.toNumber(),
    previous_period: {
      total_expense: prevTotals.expense.toNumber(),
      total_income: prevTotals.income.toNumber(),
    },
    expense_change_pct: changePct(currentTotals.expense, prevTotals.expense),
    income_change_pct: changePct(currentTotals.income, prevTotals.income),
    by_category: byCategory,
  };
}
