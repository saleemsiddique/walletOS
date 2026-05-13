import { z } from 'zod';

export const createTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive('amount must be greater than 0'),
  category_id: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
  date: z.string().date().optional(),
});

export const updateTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  amount: z.number().positive('amount must be greater than 0').optional(),
  category_id: z.string().uuid().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  date: z.string().date().optional(),
  wallet_id: z.string().uuid().optional(),
});

export const listTransactionsSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  category_id: z.string().uuid().optional(),
  wallet_id: z.string().uuid().optional(),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsSchema>;
