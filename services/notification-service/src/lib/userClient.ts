import { env } from '../config/env';

export type UserPreferences = {
  id: string;
  timezone: string;
  reminder_enabled: boolean;
  high_spend_enabled: boolean;
  high_spend_threshold: number;
};

export type UserSummary = {
  id: string;
  timezone: string;
  reminder_enabled: boolean;
};

const TIMEOUT_MS = 5000;

async function fetchWithRetry(url: string, retries = 1): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'X-Internal-Secret': env.INTERNAL_SECRET },
        signal: controller.signal,
      });
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('unreachable');
}

export async function getUserById(userId: string): Promise<UserPreferences> {
  const res = await fetchWithRetry(`${env.USER_SERVICE_URL}/internal/users/${userId}`);
  if (!res.ok) throw new Error(`user-service responded ${res.status} for user ${userId}`);
  return res.json() as Promise<UserPreferences>;
}

export async function getUsersByTimezone(
  timezone: string,
  reminderEnabled = true,
): Promise<UserSummary[]> {
  const params = new URLSearchParams({
    timezone,
    reminder_enabled: String(reminderEnabled),
  });
  const res = await fetchWithRetry(`${env.USER_SERVICE_URL}/internal/users?${params.toString()}`);
  if (!res.ok) throw new Error(`user-service responded ${res.status} for timezone ${timezone}`);
  const body = (await res.json()) as { users: UserSummary[] };
  return body.users;
}
