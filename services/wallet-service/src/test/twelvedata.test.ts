import { vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { fetchPrice, getOrRefreshPrice } from '../lib/twelvedata';

const fetchSpy = vi.spyOn(globalThis, 'fetch');

function mockResponse(body: unknown, ok = true): globalThis.Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as globalThis.Response;
}

describe('fetchPrice', () => {
  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it('parses successful TwelveData response', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse({ close: '95.43', currency: 'EUR', is_market_open: true }),
    );

    const quote = await fetchPrice('VWCE');

    expect(quote.price.toString()).toBe('95.43');
    expect(quote.currency).toBe('EUR');
    expect(quote.market_open).toBe(true);
  });

  it('throws NotFoundError on TwelveData status:error payload', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse({ status: 'error', message: 'symbol not found' }),
    );

    await expect(fetchPrice('UNKNOWN')).rejects.toThrow('Ticker UNKNOWN not found');
  });

  it('throws NotFoundError on non-2xx HTTP status', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse({}, false));

    await expect(fetchPrice('X')).rejects.toThrow('Ticker X not found');
  });
});

describe('getOrRefreshPrice', () => {
  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it('fetches and upserts when no cache exists', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse({ close: '100.00', currency: 'EUR', is_market_open: true }),
    );

    const result = await getOrRefreshPrice('VWCE');

    expect(result.price.toString()).toBe('100');
    expect(result.market_open).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const persisted = await prisma.priceCache.findUniqueOrThrow({ where: { ticker: 'VWCE' } });
    expect(persisted.price.toString()).toBe('100');
  });

  it('uses cache when market_open and age < 30min', async () => {
    await prisma.priceCache.create({
      data: {
        ticker: 'VWCE',
        price: new Decimal('100'),
        currency: 'EUR',
        market_open: true,
        last_updated: new Date(Date.now() - 10 * 60 * 1000),
      },
    });

    const result = await getOrRefreshPrice('VWCE');

    expect(result.price.toString()).toBe('100');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refreshes when market_open and age > 30min', async () => {
    await prisma.priceCache.create({
      data: {
        ticker: 'VWCE',
        price: new Decimal('100'),
        currency: 'EUR',
        market_open: true,
        last_updated: new Date(Date.now() - 31 * 60 * 1000),
      },
    });
    fetchSpy.mockResolvedValueOnce(
      mockResponse({ close: '105.50', currency: 'EUR', is_market_open: true }),
    );

    const result = await getOrRefreshPrice('VWCE');

    expect(result.price.toString()).toBe('105.5');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('uses cache when market closed and age < 24h', async () => {
    await prisma.priceCache.create({
      data: {
        ticker: 'VWCE',
        price: new Decimal('100'),
        currency: 'EUR',
        market_open: false,
        last_updated: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
    });

    await getOrRefreshPrice('VWCE');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refreshes when market closed and age > 24h', async () => {
    await prisma.priceCache.create({
      data: {
        ticker: 'VWCE',
        price: new Decimal('100'),
        currency: 'EUR',
        market_open: false,
        last_updated: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    });
    fetchSpy.mockResolvedValueOnce(
      mockResponse({ close: '110.00', currency: 'EUR', is_market_open: false }),
    );

    const result = await getOrRefreshPrice('VWCE');

    expect(result.price.toString()).toBe('110');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
