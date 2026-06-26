import { vi, beforeEach, describe, it, expect } from 'vitest';
import { getUserById, getUsersByTimezone } from './userClient';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getUserById', () => {
  it('fetches user preferences from user-service', async () => {
    const user = {
      id: 'user-1',
      timezone: 'Europe/Madrid',
      reminder_enabled: true,
      high_spend_enabled: true,
      high_spend_threshold: 100,
    };
    mockFetch.mockResolvedValueOnce(mockResponse(user));

    const result = await getUserById('user-1');
    expect(result).toEqual(user);
  });

  it('includes X-Internal-Secret header', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 'u1', timezone: 'UTC', reminder_enabled: false, high_spend_enabled: false, high_spend_threshold: 0 }));
    await getUserById('u1');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['X-Internal-Secret']).toBe(
      process.env['INTERNAL_SECRET'],
    );
  });

  it('throws when user-service returns non-2xx', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, 404));
    await expect(getUserById('missing')).rejects.toThrow('404');
  });
});

describe('getUsersByTimezone', () => {
  it('parses the users array from the response', async () => {
    const users = [{ id: 'u1', timezone: 'Europe/Madrid', reminder_enabled: true }];
    mockFetch.mockResolvedValueOnce(mockResponse({ users }));

    const result = await getUsersByTimezone('Europe/Madrid');
    expect(result).toEqual(users);
  });

  it('sends timezone and reminder_enabled as query params', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ users: [] }));
    await getUsersByTimezone('America/New_York', true);

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('timezone=America%2FNew_York');
    expect(url).toContain('reminder_enabled=true');
  });

  it('includes X-Internal-Secret header', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ users: [] }));
    await getUsersByTimezone('UTC');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['X-Internal-Secret']).toBeDefined();
  });
});
