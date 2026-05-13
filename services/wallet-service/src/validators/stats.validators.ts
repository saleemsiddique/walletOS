import { z } from 'zod';

export const statsQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
  bank_id: z.string().uuid().optional(),
  wallet_id: z.string().uuid().optional(),
});

export const statsDailyQuerySchema = z
  .object({
    from: z.string().date(),
    to: z.string().date(),
    bank_id: z.string().uuid().optional(),
    wallet_id: z.string().uuid().optional(),
  })
  .refine(
    (data) => new Date(data.from) <= new Date(data.to),
    { message: 'from must be before or equal to to', path: ['from'] },
  )
  .refine(
    (data) => {
      const diffMs = new Date(data.to).getTime() - new Date(data.from).getTime();
      return diffMs <= 31 * 24 * 60 * 60 * 1000;
    },
    { message: 'date range cannot exceed 31 days', path: ['to'] },
  );

export type StatsQuery = z.infer<typeof statsQuerySchema>;
export type StatsDailyQuery = z.infer<typeof statsDailyQuerySchema>;
