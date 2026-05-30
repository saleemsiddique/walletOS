import { z } from 'zod';

export const createInvestmentTransactionSchema = z.object({
  ticker: z.string().min(1).max(20),
  asset_name: z.string().min(1).max(100),
  type: z.enum(['BUY', 'SELL', 'DIVIDEND']),
  shares: z.number().positive('shares must be greater than 0'),
  price_per_share: z.number().positive('price_per_share must be greater than 0'),
  currency: z.string().length(3).optional(),
  note: z.string().max(500).optional(),
  date: z.string().date().optional(),
});

export const listInvestmentTransactionsSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  ticker: z.string().min(1).max(20).optional(),
  type: z.enum(['BUY', 'SELL', 'DIVIDEND']).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export type CreateInvestmentTransactionInput = z.infer<
  typeof createInvestmentTransactionSchema
>;
export type ListInvestmentTransactionsQuery = z.infer<
  typeof listInvestmentTransactionsSchema
>;
