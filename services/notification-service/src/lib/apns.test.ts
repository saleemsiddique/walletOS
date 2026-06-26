import { vi, beforeEach, describe, it, expect } from 'vitest';

const mockSend = vi.fn();
const MockApnsClient = vi.fn().mockImplementation(() => ({ send: mockSend }));

vi.mock('apns2', () => ({
  default: MockApnsClient,
  Notification: vi.fn().mockImplementation((_token, payload) => payload),
  Errors: {
    badDeviceToken: 'BadDeviceToken',
    unregistered: 'Unregistered',
    deviceTokenNotForTopic: 'DeviceTokenNotForTopic',
  },
}));

import { sendPush, resetApnsClient } from './apns';

beforeEach(() => {
  vi.clearAllMocks();
  resetApnsClient();
});

describe('sendPush', () => {
  it('returns "sent" on success', async () => {
    mockSend.mockResolvedValueOnce(undefined);
    const result = await sendPush('valid-token', {
      title: 'Recordatorio',
      body: '¿Has anotado tus gastos de hoy?',
      type: 'reminder',
    });
    expect(result).toBe('sent');
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it('maps title and body into aps.alert payload', async () => {
    mockSend.mockResolvedValueOnce(undefined);
    await sendPush('token-abc', { title: 'Gasto alto', body: 'Has gastado 200€', type: 'high_spend' });

    const { Notification } = await import('apns2');
    const callArgs = vi.mocked(Notification).mock.calls[0];
    expect(callArgs![0]).toBe('token-abc');
    expect(callArgs![1]).toMatchObject({
      aps: { alert: { title: 'Gasto alto', body: 'Has gastado 200€' } },
      data: { type: 'high_spend' },
    });
  });

  it('returns "invalid_token" for BadDeviceToken', async () => {
    mockSend.mockRejectedValueOnce({ reason: 'BadDeviceToken' });
    const result = await sendPush('bad-token', { title: 'T', body: 'B', type: 'reminder' });
    expect(result).toBe('invalid_token');
  });

  it('returns "invalid_token" for Unregistered (410)', async () => {
    mockSend.mockRejectedValueOnce({ reason: 'Unregistered' });
    const result = await sendPush('expired-token', { title: 'T', body: 'B', type: 'reminder' });
    expect(result).toBe('invalid_token');
  });

  it('returns "failed" for other APNs errors', async () => {
    mockSend.mockRejectedValueOnce({ reason: 'InternalServerError' });
    const result = await sendPush('token', { title: 'T', body: 'B', type: 'reminder' });
    expect(result).toBe('failed');
  });

  it('builds the client with env config on first call', async () => {
    mockSend.mockResolvedValueOnce(undefined);
    await sendPush('token', { title: 'T', body: 'B', type: 'reminder' });
    expect(MockApnsClient).toHaveBeenCalledWith(
      expect.objectContaining({
        team: process.env['APNS_TEAM_ID'],
        keyId: process.env['APNS_KEY_ID'],
        host: 'api.development.push.apple.com',
      }),
    );
  });
});
