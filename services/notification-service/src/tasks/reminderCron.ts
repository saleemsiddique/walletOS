import cron from 'node-cron';
import { getRedis } from '../lib/redis';
import { getUsersByTimezone } from '../lib/userClient';
import { sendNotification } from '../services/notificationSender';

// Major IANA timezones covering all UTC offsets inhabited by users.
const CANDIDATE_TIMEZONES = [
  'Pacific/Midway',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Halifax',
  'America/Sao_Paulo',
  'Atlantic/South_Georgia',
  'Atlantic/Azores',
  'UTC',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Helsinki',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const REMINDER_HOUR = 21;
const WINDOW_MINUTES = 30;
const REMINDER_TTL_SECONDS = 2 * 60 * 60;

export function getLocalMinutesSinceMidnight(timezone: string, now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const hour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
  // Intl uses 24 for midnight in hour12:false — normalise to 0.
  return (hour === 24 ? 0 : hour) * 60 + minute;
}

export function getTimezonesInReminderWindow(now: Date): string[] {
  const target = REMINDER_HOUR * 60;
  return CANDIDATE_TIMEZONES.filter((tz) => {
    const localMinutes = getLocalMinutesSinceMidnight(tz, now);
    return Math.abs(localMinutes - target) <= WINDOW_MINUTES;
  });
}

export async function runReminderCron(now = new Date()): Promise<void> {
  const today = now.toISOString().slice(0, 10);
  const timezones = getTimezonesInReminderWindow(now);

  for (const timezone of timezones) {
    const users = await getUsersByTimezone(timezone, true);

    for (const user of users) {
      const activityKey = `activity:${user.id}:${today}`;
      const reminderKey = `notif:${user.id}:${today}:reminder`;

      const [hasActivity, hasSentReminder] = await Promise.all([
        getRedis().exists(activityKey),
        getRedis().exists(reminderKey),
      ]);

      if (hasActivity || hasSentReminder) continue;

      await sendNotification(user.id, {
        type: 'reminder',
        title: 'Recordatorio',
        body: '¿Has anotado tus gastos de hoy?',
      });

      await getRedis().set(reminderKey, '1', 'EX', REMINDER_TTL_SECONDS);
    }
  }
}

export function scheduleReminderCron(): void {
  cron.schedule('0 * * * *', () => {
    runReminderCron().catch((err: unknown) => {
      process.stderr.write(`[reminder-cron] failed: ${String(err)}\n`);
    });
  });
}
