import { prisma } from '../lib/prisma';
import type { ListNotificationsQuery } from '../validators/notification.validators';

export async function listNotifications(userId: string, query: ListNotificationsQuery) {
  const { limit, cursor } = query;

  const [items, unread_count] = await Promise.all([
    prisma.notification.findMany({
      where: {
        user_id: userId,
        ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: limit + 1,
    }),
    prisma.notification.count({ where: { user_id: userId, read_at: null } }),
  ]);

  const hasMore = items.length > limit;
  const notifications = hasMore ? items.slice(0, limit) : items;
  const next_cursor = hasMore
    ? notifications[notifications.length - 1]!.created_at.toISOString()
    : null;

  return { notifications, unread_count, next_cursor };
}

export async function markOneRead(userId: string, notificationId: string) {
  const notif = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notif || notif.user_id !== userId) return null;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { read_at: new Date() },
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { user_id: userId, read_at: null },
    data: { read_at: new Date() },
  });
}
