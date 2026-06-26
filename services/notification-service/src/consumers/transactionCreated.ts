import { subscribe } from '../lib/rabbitmq';
import { getRedis } from '../lib/redis';
import { getUserById } from '../lib/userClient';
import { sendNotification } from '../services/notificationSender';

const QUEUE = 'notification-service.transaction.created';
const ROUTING_KEY = 'transaction.created';
const ACTIVITY_TTL_SECONDS = 26 * 60 * 60;

type TransactionCreatedData = {
  user_id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category_name: string | null;
};

type TransactionCreatedEvent = {
  event: string;
  data: TransactionCreatedData;
};

function parseEvent(payload: unknown): TransactionCreatedData {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('data' in payload) ||
    typeof (payload as TransactionCreatedEvent).data !== 'object'
  ) {
    throw new Error('Invalid transaction.created payload: missing data');
  }
  const data = (payload as TransactionCreatedEvent).data;
  if (typeof data.user_id !== 'string' || data.user_id.length === 0) {
    throw new Error('Invalid transaction.created payload: missing data.user_id');
  }
  if (data.type !== 'INCOME' && data.type !== 'EXPENSE') {
    throw new Error('Invalid transaction.created payload: invalid data.type');
  }
  if (typeof data.amount !== 'number') {
    throw new Error('Invalid transaction.created payload: invalid data.amount');
  }
  return data;
}

function activityKey(userId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `activity:${userId}:${date}`;
}

export async function handleTransactionCreated(payload: unknown): Promise<void> {
  const data = parseEvent(payload);
  const { user_id, type, amount, category_name } = data;

  await getRedis().set(activityKey(user_id), '1', 'EX', ACTIVITY_TTL_SECONDS);

  if (type !== 'EXPENSE') return;

  const user = await getUserById(user_id);

  if (!user.high_spend_enabled || amount < user.high_spend_threshold) return;

  const category = category_name ?? 'Sin categoría';
  await sendNotification(user_id, {
    type: 'high_spend',
    title: 'Gasto alto',
    body: `Has registrado un gasto de ${amount}€ en ${category}`,
  });
}

export async function startTransactionCreatedConsumer(): Promise<void> {
  await subscribe(QUEUE, ROUTING_KEY, handleTransactionCreated);
}
