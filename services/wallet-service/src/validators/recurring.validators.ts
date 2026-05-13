import { z } from 'zod';

export const createRecurringSchema = z
  .object({
    wallet_id: z.string().uuid(),
    type: z.enum(['INCOME', 'EXPENSE']),
    amount: z.number().positive('amount must be greater than 0'),
    category_id: z.string().uuid().optional(),
    note: z.string().max(500).optional(),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    day_of_month: z.number().int().min(1).max(31).optional(),
    day_of_week: z.number().int().min(0).max(6).optional(),
    starts_at: z.string().date().optional(),
  })
  .refine(
    (data) => data.frequency !== 'MONTHLY' || data.day_of_month !== undefined,
    { message: 'day_of_month is required when frequency is MONTHLY', path: ['day_of_month'] },
  )
  .refine(
    (data) => data.frequency !== 'WEEKLY' || data.day_of_week !== undefined,
    { message: 'day_of_week is required when frequency is WEEKLY', path: ['day_of_week'] },
  );

export const updateRecurringSchema = z.object({
  amount: z.number().positive('amount must be greater than 0').optional(),
  note: z.string().max(500).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
