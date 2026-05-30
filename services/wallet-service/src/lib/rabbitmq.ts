import amqplib, { type Channel, type ConsumeMessage } from 'amqplib';
import { env } from '../config/env';

const EXCHANGE = 'walletOS.events';
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;

let channel: Channel | null = null;

export async function connectRabbitMQ(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await amqplib.connect(env.RABBITMQ_URL);
      const ch: Channel = await conn.createChannel();
      await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
      channel = ch;
      return;
    } catch {
      if (attempt === MAX_RETRIES) throw new Error('RabbitMQ connection failed after max retries');
      await new Promise((r) => globalThis.setTimeout(r, BASE_DELAY_MS * 2 ** (attempt - 1)));
    }
  }
}

export function publishEvent(routingKey: string, payload: object): void {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true });
}

export async function subscribe(
  queueName: string,
  routingKey: string,
  handler: (payload: unknown) => Promise<void>,
): Promise<void> {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  const ch = channel;
  await ch.assertQueue(queueName, { durable: true });
  await ch.bindQueue(queueName, EXCHANGE, routingKey);
  await ch.consume(queueName, (msg: ConsumeMessage | null) => {
    if (msg === null) return;
    void (async () => {
      try {
        const payload = JSON.parse(msg.content.toString()) as unknown;
        await handler(payload);
        ch.ack(msg);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[rabbitmq] consumer ${queueName} failed: ${message}\n`);
        // Sin requeue: evita loops infinitos si el payload es estructuralmente inválido.
        ch.nack(msg, false, false);
      }
    })();
  });
}
