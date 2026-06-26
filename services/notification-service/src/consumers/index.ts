import { startUserDeletedConsumer } from './userDeleted';

export async function startAllConsumers(): Promise<void> {
  await startUserDeletedConsumer();
}
