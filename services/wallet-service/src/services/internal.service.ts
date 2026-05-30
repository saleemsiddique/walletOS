import { prisma } from '../lib/prisma';
import { getRedis } from '../lib/redis';

const CATEGORIES_CACHE_TTL_SECONDS = 24 * 60 * 60;

function userCategoriesCacheKey(userId: string): string {
  return `internal:categories:${userId}`;
}

export async function invalidateUserCategoriesCache(userId: string): Promise<void> {
  try {
    await getRedis().del(userCategoriesCacheKey(userId));
  } catch {
    // Cache failures should not break category writes — el siguiente GET
    // recalculará y sobrescribirá con SETEX.
  }
}

export type InternalTransactionDTO = {
  id: string;
  wallet_id: string;
  wallet_name: string;
  bank_name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: { id: string; name: string; icon: string; type: 'INCOME' | 'EXPENSE' } | null;
  note: string | null;
  date: string;
  transfer_id: string | null;
  created_at: Date;
};

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type InternalCategoryDTO = {
  id: string;
  name: string;
  icon: string;
  type: 'INCOME' | 'EXPENSE';
};

export async function listUserCategoriesInternal(
  userId: string,
): Promise<{ categories: InternalCategoryDTO[] }> {
  const redis = getRedis();
  const cacheKey = userCategoriesCacheKey(userId);

  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as { categories: InternalCategoryDTO[] };
    }
  } catch {
    // Cache miss por error de Redis → continuamos con DB.
  }

  const rows = await prisma.category.findMany({
    where: { OR: [{ user_id: null }, { user_id: userId }] },
    orderBy: [{ user_id: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
  });
  const payload = {
    categories: rows.map((c) => ({ id: c.id, name: c.name, icon: c.icon, type: c.type })),
  };

  try {
    await redis.set(cacheKey, JSON.stringify(payload), 'EX', CATEGORIES_CACHE_TTL_SECONDS);
  } catch {
    // No bloquear la respuesta por un fallo de cache.
  }

  return payload;
}

export async function listUserTransactionsInternal(
  userId: string,
  from: string,
  to: string,
): Promise<{ transactions: InternalTransactionDTO[] }> {
  const fromDate = new Date(from);
  const toExclusive = new Date(to);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

  const rows = await prisma.transaction.findMany({
    where: {
      user_id: userId,
      date: { gte: fromDate, lt: toExclusive },
      transfer_id: null,
    },
    orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
    include: { wallet: { include: { bank: true } }, category: true },
  });

  return {
    transactions: rows.map((tx) => ({
      id: tx.id,
      wallet_id: tx.wallet_id,
      wallet_name: tx.wallet.name,
      bank_name: tx.wallet.bank.name,
      type: tx.type,
      amount: tx.amount.toNumber(),
      category: tx.category
        ? {
            id: tx.category.id,
            name: tx.category.name,
            icon: tx.category.icon,
            type: tx.category.type,
          }
        : null,
      note: tx.note,
      date: toDateString(tx.date),
      transfer_id: tx.transfer_id,
      created_at: tx.created_at,
    })),
  };
}
