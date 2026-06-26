import { readFileSync } from 'fs';
import ApnsClient, { Notification, Errors } from 'apns2';
import { env } from '../config/env';

let client: ApnsClient | null = null;

function getSigningKey(): string {
  if (env.APNS_KEY) return env.APNS_KEY;
  if (env.APNS_KEY_PATH) return readFileSync(env.APNS_KEY_PATH, 'utf-8');
  throw new Error('Either APNS_KEY or APNS_KEY_PATH must be set');
}

function getClient(): ApnsClient {
  if (!client) {
    client = new ApnsClient({
      team: env.APNS_TEAM_ID,
      keyId: env.APNS_KEY_ID,
      signingKey: getSigningKey(),
      defaultTopic: env.APNS_BUNDLE_ID,
      host:
        env.APNS_ENV === 'production'
          ? 'api.push.apple.com'
          : 'api.development.push.apple.com',
    });
  }
  return client;
}

export type SendPushResult = 'sent' | 'failed' | 'invalid_token';

const INVALID_TOKEN_REASONS = new Set([
  Errors.badDeviceToken,
  Errors.unregistered,
  Errors.deviceTokenNotForTopic,
]);

export async function sendPush(
  token: string,
  { title, body, type }: { title: string; body: string; type: string },
): Promise<SendPushResult> {
  try {
    const notification = new Notification(token, {
      aps: { alert: { title, body }, sound: 'default' },
      data: { type },
    });
    await getClient().send(notification);
    return 'sent';
  } catch (err) {
    const reason = (err as { reason?: string }).reason;
    if (reason !== undefined && INVALID_TOKEN_REASONS.has(reason)) {
      return 'invalid_token';
    }
    return 'failed';
  }
}

export function resetApnsClient(): void {
  client = null;
}
