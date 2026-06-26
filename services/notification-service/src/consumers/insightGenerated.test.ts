import { vi } from 'vitest';

vi.mock('../lib/rabbitmq', () => ({ subscribe: vi.fn() }));
vi.mock('../services/notificationSender', () => ({ sendNotification: vi.fn() }));

import { sendNotification } from '../services/notificationSender';
import { handleInsightGenerated } from './insightGenerated';

const mockSend = vi.mocked(sendNotification);

const USER_A = 'a0000000-0000-0000-0000-000000000001';

function makePayload(overrides: Partial<{ user_id: string }> = {}) {
  return {
    event: 'insight.generated',
    data: { user_id: USER_A, insight_id: 'insight-uuid', week_start: '2026-06-16', ...overrides },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue(undefined);
});

describe('handleInsightGenerated', () => {
  it('sends a weekly_insight notification to the user', async () => {
    await handleInsightGenerated(makePayload());

    expect(mockSend).toHaveBeenCalledWith(USER_A, {
      type: 'weekly_insight',
      title: 'Resumen semanal',
      body: 'Tu resumen semanal está listo',
    });
  });

  it('throws on invalid payload', async () => {
    await expect(handleInsightGenerated(null)).rejects.toThrow();
    await expect(handleInsightGenerated({ data: {} })).rejects.toThrow();
    await expect(handleInsightGenerated({ data: { user_id: '' } })).rejects.toThrow();
  });
});
