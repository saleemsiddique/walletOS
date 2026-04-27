import amqplib, { type Channel } from 'amqplib';
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
