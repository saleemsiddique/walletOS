import { vi } from 'vitest';

vi.mock('../lib/redis', () => ({ getRedis: vi.fn() }));
vi.mock('../lib/userClient', () => ({ getUsersByTimezone: vi.fn() }));
vi.mock('../services/notificationSender', () => ({ sendNotification: vi.fn() }));

import { getRedis } from '../lib/redis';
import { getUsersByTimezone } from '../lib/userClient';
import { sendNotification } from '../services/notificationSender';
import {
  getLocalMinutesSinceMidnight,
  getTimezonesInReminderWindow,
  runReminderCron,
} from './reminderCron';

const mockRedis = { exists: vi.fn(), set: vi.fn() };
vi.mocked(getRedis).mockReturnValue(mockRedis as never);

const mockGetUsers = vi.mocked(getUsersByTimezone);
const mockSend = vi.mocked(sendNotification);

const USER_A = { id: 'a0000000-0000-0000-0000-000000000001', timezone: 'UTC', reminder_enabled: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRedis).mockReturnValue(mockRedis as never);
  mockRedis.exists.mockResolvedValue(0);
  mockRedis.set.mockResolvedValue('OK');
  mockSend.mockResolvedValue(undefined);
});

describe('getLocalMinutesSinceMidnight', () => {
  it('returns minutes since midnight for Europe/Madrid at 21:00 UTC+1', () => {
    // 2026-06-26 20:00 UTC = 21:00 Europe/Madrid (CEST = UTC+2 in summer)
    // Actually CEST is UTC+2, so 19:00 UTC = 21:00 CEST
    const now = new Date('2026-06-26T19:00:00Z');
    const minutes = getLocalMinutesSinceMidnight('Europe/Madrid', now);
    expect(minutes).toBe(21 * 60); // 1260
  });

  it('returns minutes since midnight for UTC', () => {
    const now = new Date('2026-06-26T21:00:00Z');
    const minutes = getLocalMinutesSinceMidnight('UTC', now);
    expect(minutes).toBe(21 * 60);
  });
});

describe('getTimezonesInReminderWindow', () => {
  it('includes timezones whose local time is within ±30 min of 21:00', () => {
    // UTC 21:00 → UTC timezone is at 21:00 exactly → should be included
    const now = new Date('2026-06-26T21:00:00Z');
    const tzs = getTimezonesInReminderWindow(now);
    expect(tzs).toContain('UTC');
  });

  it('excludes timezones outside the ±30 min window', () => {
    // UTC 21:00 → Europe/Madrid (CEST=UTC+2) local = 23:00 → outside window
    const now = new Date('2026-06-26T21:00:00Z');
    const tzs = getTimezonesInReminderWindow(now);
    expect(tzs).not.toContain('Europe/Madrid');
  });

  it('returns empty array when no timezone matches', () => {
    // UTC 03:00 — no major timezone at 21:00 ± 30min
    const now = new Date('2026-06-26T03:30:00Z');
    const tzs = getTimezonesInReminderWindow(now);
    expect(tzs.length).toBe(0);
  });
});

describe('runReminderCron', () => {
  // UTC 21:00 → UTC timezone is in window
  const now = new Date('2026-06-26T21:00:00Z');

  it('sends reminder to eligible users in-window timezones', async () => {
    mockGetUsers.mockResolvedValue([USER_A]);

    await runReminderCron(now);

    expect(mockSend).toHaveBeenCalledWith(USER_A.id, {
      type: 'reminder',
      title: 'Recordatorio',
      body: '¿Has anotado tus gastos de hoy?',
    });
  });

  it('skips user that already has activity key', async () => {
    mockGetUsers.mockResolvedValue([USER_A]);
    mockRedis.exists
      .mockResolvedValueOnce(1) // activity key exists
      .mockResolvedValueOnce(0);

    await runReminderCron(now);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips user that already received reminder today', async () => {
    mockGetUsers.mockResolvedValue([USER_A]);
    mockRedis.exists
      .mockResolvedValueOnce(0) // no activity
      .mockResolvedValueOnce(1); // reminder already sent

    await runReminderCron(now);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sets reminder key with 2h TTL after sending', async () => {
    mockGetUsers.mockResolvedValue([USER_A]);

    await runReminderCron(now);

    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^notif:.+:reminder$/),
      '1',
      'EX',
      7200,
    );
  });

  it('does not query user-service when no timezone is in window', async () => {
    const outOfWindow = new Date('2026-06-26T03:30:00Z');
    await runReminderCron(outOfWindow);
    expect(mockGetUsers).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });
});
