import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { ListNotificationsQuery } from '../validators/notification.validators';

type Keyset = { createdAt: Date; id: string };

// El cursor combina created_at e id porque created_at (precisión ms) no es único:
// varias notificaciones pueden compartir timestamp y un cursor solo por fecha se las saltaría.
function encodeCursor({ created_at, id }: { created_at: Date; id: string }): string {
  return `${created_at.toISOString()}__${id}`;
}

function decodeCursor(cursor: string): Keyset | null {
  const [isoDate, id] = cursor.split('__');
  if (!isoDate || !id) return null;
  const createdAt = new Date(isoDate);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}

function buildCursorFilter(cursor?: string): Prisma.NotificationWhereInput {
  if (!cursor) return {};
  const keyset = decodeCursor(cursor);
  if (!keyset) return {};
  return {
    OR: [
      { created_at: { lt: keyset.createdAt } },
      { created_at: keyset.createdAt, id: { lt: keyset.id } },
    ],
  };
}

export async function listNotifications(userId: string, query: ListNotificationsQuery) {
  const { limit, cursor } = query;

  const [items, unread_count] = await Promise.all([
    prisma.notification.findMany({
      where: { user_id: userId, ...buildCursorFilter(cursor) },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    }),
    prisma.notification.count({ where: { user_id: userId, read_at: null } }),
  ]);

  const hasMore = items.length > limit;
  const notifications = hasMore ? items.slice(0, limit) : items;
  const next_cursor = hasMore ? encodeCursor(notifications[notifications.length - 1]!) : null;

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
