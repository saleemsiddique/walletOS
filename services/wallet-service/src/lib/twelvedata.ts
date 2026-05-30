import { Decimal } from '@prisma/client/runtime/library';
import { env } from '../config/env';
import { prisma } from './prisma';
import { NotFoundError } from '../middleware/errorHandler';

const ENDPOINT = 'https://api.twelvedata.com/quote';
// TTL elegido para encajar en el free tier de TwelveData (800 credits/día).
// 30 min × 16 ciclos/día (mercado europeo ~8h) × 50 tickers únicos = 800 credits.
// Permite servir a cualquier número de usuarios con hasta 50 ETFs distintos
// entre todos. Si la base de tickers únicos supera 50 hay que subir el TTL o
// pasar al plan Grow.
const TTL_MARKET_OPEN_MS = 30 * 60 * 1000;
const TTL_MARKET_CLOSED_MS = 24 * 60 * 60 * 1000;

export type Quote = {
  price: Decimal;
  currency: string;
  market_open: boolean;
};

type TwelveDataQuote = {
  status?: 'error';
  message?: string;
  close?: string;
  currency?: string;
  is_market_open?: boolean;
};

export async function fetchPrice(ticker: string): Promise<Quote> {
  const url = `${ENDPOINT}?symbol=${encodeURIComponent(ticker)}&apikey=${env.TWELVE_DATA_API_KEY}`;
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new NotFoundError(`Ticker ${ticker} not found`);
  }
  const data = (await response.json()) as TwelveDataQuote;
  if (data.status === 'error' || data.close === undefined || data.currency === undefined) {
    throw new NotFoundError(`Ticker ${ticker} not found`);
  }
  return {
    price: new Decimal(data.close),
    currency: data.currency,
    market_open: data.is_market_open === true,
  };
}

export type CachedPrice = {
  price: Decimal;
  currency: string;
  market_open: boolean;
  last_updated: Date;
};

export async function getOrRefreshPrice(ticker: string): Promise<CachedPrice> {
  const cached = await prisma.priceCache.findUnique({ where: { ticker } });
  if (cached !== null) {
    const ageMs = Date.now() - cached.last_updated.getTime();
    const ttlMs = cached.market_open ? TTL_MARKET_OPEN_MS : TTL_MARKET_CLOSED_MS;
    if (ageMs < ttlMs) return cached;
  }

  const fresh = await fetchPrice(ticker);
  const now = new Date();
  const upserted = await prisma.priceCache.upsert({
    where: { ticker },
    update: {
      price: fresh.price,
      currency: fresh.currency,
      market_open: fresh.market_open,
      last_updated: now,
    },
    create: {
      ticker,
      price: fresh.price,
      currency: fresh.currency,
      market_open: fresh.market_open,
      last_updated: now,
    },
  });
  return upserted;
}
