import { prisma } from '../lib/prisma';
import { subscribe } from '../lib/rabbitmq';
import { invalidateUserCategoriesCache } from '../services/internal.service';

const QUEUE = 'wallet-service.user.deleted';
const ROUTING_KEY = 'user.deleted';

type UserDeletedEvent = { event: string; data: { user_id: string } };

function parseEvent(payload: unknown): string {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('data' in payload) ||
    typeof (payload as UserDeletedEvent).data !== 'object'
  ) {
    throw new Error('Invalid user.deleted payload: missing data');
  }
  const data = (payload as UserDeletedEvent).data;
  if (typeof data.user_id !== 'string' || data.user_id.length === 0) {
    throw new Error('Invalid user.deleted payload: missing data.user_id');
  }
  return data.user_id;
}

export async function handleUserDeleted(payload: unknown): Promise<void> {
  const userId = parseEvent(payload);

  await prisma.$transaction([
    prisma.recurringRule.deleteMany({ where: { user_id: userId } }),
    prisma.transaction.deleteMany({ where: { user_id: userId } }),
    prisma.wallet.deleteMany({ where: { user_id: userId } }),
    prisma.bank.deleteMany({ where: { user_id: userId } }),
    prisma.category.deleteMany({ where: { user_id: userId } }),
  ]);
  await invalidateUserCategoriesCache(userId);
}

export async function startUserDeletedConsumer(): Promise<void> {
  await subscribe(QUEUE, ROUTING_KEY, handleUserDeleted);
}
