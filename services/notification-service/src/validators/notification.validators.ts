import { z } from 'zod';

export const listNotificationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;
