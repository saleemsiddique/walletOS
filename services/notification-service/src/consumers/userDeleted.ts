import { prisma } from '../lib/prisma';
import { subscribe } from '../lib/rabbitmq';

const QUEUE = 'notification-service.user.deleted';
const ROUTING_KEY = 'user.deleted';

function parseEvent(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('user_id' in payload)) {
    throw new Error('Invalid user.deleted payload: missing user_id');
  }
  const { user_id } = payload as { user_id: unknown };
  if (typeof user_id !== 'string' || user_id.length === 0) {
    throw new Error('Invalid user.deleted payload: user_id must be a non-empty string');
  }
  return user_id;
}

export async function handleUserDeleted(payload: unknown): Promise<void> {
  const userId = parseEvent(payload);

  await prisma.$transaction([
    prisma.deviceToken.deleteMany({ where: { user_id: userId } }),
    prisma.notification.deleteMany({ where: { user_id: userId } }),
  ]);
}

export async function startUserDeletedConsumer(): Promise<void> {
  await subscribe(QUEUE, ROUTING_KEY, handleUserDeleted);
}
