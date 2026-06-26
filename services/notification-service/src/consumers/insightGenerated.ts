import { subscribe } from '../lib/rabbitmq';
import { sendNotification } from '../services/notificationSender';

const QUEUE = 'notification-service.insight.generated';
const ROUTING_KEY = 'insight.generated';

type InsightGeneratedEvent = {
  event: string;
  data: { user_id: string; insight_id: string; week_start: string };
};

function parseEvent(payload: unknown): string {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('data' in payload) ||
    typeof (payload as InsightGeneratedEvent).data !== 'object'
  ) {
    throw new Error('Invalid insight.generated payload: missing data');
  }
  const { user_id } = (payload as InsightGeneratedEvent).data;
  if (typeof user_id !== 'string' || user_id.length === 0) {
    throw new Error('Invalid insight.generated payload: missing data.user_id');
  }
  return user_id;
}

export async function handleInsightGenerated(payload: unknown): Promise<void> {
  const userId = parseEvent(payload);
  await sendNotification(userId, {
    type: 'weekly_insight',
    title: 'Resumen semanal',
    body: 'Tu resumen semanal está listo',
  });
}

export async function startInsightGeneratedConsumer(): Promise<void> {
  await subscribe(QUEUE, ROUTING_KEY, handleInsightGenerated);
}
