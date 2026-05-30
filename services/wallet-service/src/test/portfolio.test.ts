import { vi } from 'vitest';

vi.mock('../lib/twelvedata', () => ({
  fetchPrice: vi.fn(),
  getOrRefreshPrice: vi.fn(),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Decimal } from '@prisma/client/runtime/library';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { getOrRefreshPrice } from '../lib/twelvedata';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

const getOrRefreshPriceMock = vi.mocked(getOrRefreshPrice);

function mockQuote(ticker: string, price: string): void {
  getOrRefreshPriceMock.mockImplementation((requested: string) => {
    if (requested !== ticker) {
      return Promise.reject(new Error(`unexpected ticker ${requested}`));
    }
    return Promise.resolve({
      price: new Decimal(price),
      currency: 'EUR',
      market_open: true,
      last_updated: new Date(),
    });
  });
}

type PortfolioBody = {
  positions: {
    ticker: string;
    asset_name: string;
    shares: string;
    avg_cost_per_share: string;
    current_price: string;
    value: string;
    cost: string;
    gain: string;
    gain_pct: string;
  }[];
  total_value: string;
  total_cost: string;
  total_gain: string;
  total_gain_pct: string;
};

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';
const VALID_UUID = '00000000-0000-0000-0000-000000000abc';

async function makeInvestmentWallet(userId: string): Promise<string> {
  const bank = await prisma.bank.create({ data: { user_id: userId, name: 'Broker' } });
  const wallet = await prisma.wallet.create({
    data: { user_id: userId, bank_id: bank.id, name: 'Cartera', type: 'INVESTMENT' },
  });
  return wallet.id;
}

async function buy(
  walletId: string,
  userId: string,
  ticker: string,
  shares: string,
  pricePerShare: string,
  date: string,
): Promise<void> {
  const total = new Decimal(shares).mul(new Decimal(pricePerShare)).toDecimalPlaces(2);
  await prisma.investmentTransaction.create({
    data: {
      user_id: userId,
      wallet_id: walletId,
      ticker,
      asset_name: ticker,
      type: 'BUY',
      shares,
      price_per_share: pricePerShare,
      total_amount: total,
      date: new Date(date),
    },
  });
}

async function sell(
  walletId: string,
  userId: string,
  ticker: string,
  shares: string,
  pricePerShare: string,
  date: string,
): Promise<void> {
  const total = new Decimal(shares).mul(new Decimal(pricePerShare)).toDecimalPlaces(2);
  await prisma.investmentTransaction.create({
    data: {
      user_id: userId,
      wallet_id: walletId,
      ticker,
      asset_name: ticker,
      type: 'SELL',
      shares,
      price_per_share: pricePerShare,
      total_amount: total,
      date: new Date(date),
    },
  });
}

describe('GET /wallets/:id/portfolio', () => {
  beforeEach(() => {
    getOrRefreshPriceMock.mockReset();
  });

  it('401 without token', async () => {
    const res = await request(createApp()).get(`/wallets/${VALID_UUID}/portfolio`);
    expect(res.status).toBe(401);
  });

  it('200 computes positions, value, cost, gain after BUYs', async () => {
    const walletId = await makeInvestmentWallet(USER_A);
    await buy(walletId, USER_A, 'VWCE', '5', '80', '2026-01-10');
    await buy(walletId, USER_A, 'VWCE', '5', '90', '2026-01-15');
    mockQuote('VWCE', '100');

    const res = await request(createApp())
      .get(`/wallets/${walletId}/portfolio`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(200);
    const body = res.body as PortfolioBody;
    expect(body.positions).toHaveLength(1);
    expect(body.positions[0]).toMatchObject({
      ticker: 'VWCE',
      avg_cost_per_share: '85', // (5*80 + 5*90) / 10
      current_price: '100',
      value: '1000', // 10 * 100
      cost: '850', // 10 * 85
      gain: '150',
      gain_pct: '17.65',
    });
    expect(body.total_value).toBe('1000');
    expect(body.total_gain).toBe('150');
  });

  it('SELL reduces shares; position with shares=0 disappears', async () => {
    const walletId = await makeInvestmentWallet(USER_A);
    await buy(walletId, USER_A, 'VWCE', '10', '80', '2026-01-10');
    await sell(walletId, USER_A, 'VWCE', '10', '95', '2026-01-20');

    const res = await request(createApp())
      .get(`/wallets/${walletId}/portfolio`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as PortfolioBody;

    expect(body.positions).toHaveLength(0);
    expect(getOrRefreshPriceMock).not.toHaveBeenCalled();
  });

  it('DIVIDEND does not affect shares nor avg_cost', async () => {
    const walletId = await makeInvestmentWallet(USER_A);
    await buy(walletId, USER_A, 'VWCE', '10', '80', '2026-01-10');
    await prisma.investmentTransaction.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        ticker: 'VWCE',
        asset_name: 'VWCE',
        type: 'DIVIDEND',
        shares: '10',
        price_per_share: '0.5',
        total_amount: '5',
        date: new Date('2026-02-01'),
      },
    });
    mockQuote('VWCE', '80');

    const res = await request(createApp())
      .get(`/wallets/${walletId}/portfolio`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as PortfolioBody;

    expect(body.positions).toHaveLength(1);
    expect(body.positions[0]).toMatchObject({
      shares: '10',
      avg_cost_per_share: '80',
      cost: '800',
    });
  });

  it('queries price once per distinct ticker (not per transaction)', async () => {
    const walletId = await makeInvestmentWallet(USER_A);
    await buy(walletId, USER_A, 'VWCE', '5', '80', '2026-01-10');
    await buy(walletId, USER_A, 'VWCE', '5', '90', '2026-01-15');
    mockQuote('VWCE', '100');

    await request(createApp())
      .get(`/wallets/${walletId}/portfolio`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(getOrRefreshPriceMock).toHaveBeenCalledOnce();
    expect(getOrRefreshPriceMock).toHaveBeenCalledWith('VWCE');
  });

  it('400 when wallet is of type CASH', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    const wallet = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Nómina', type: 'CASH' },
    });

    const res = await request(createApp())
      .get(`/wallets/${wallet.id}/portfolio`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(400);
  });

  it('404 with non-existing wallet', async () => {
    const res = await request(createApp())
      .get(`/wallets/${VALID_UUID}/portfolio`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });

  it('404 with wallet of another user', async () => {
    const walletId = await makeInvestmentWallet(USER_B);

    const res = await request(createApp())
      .get(`/wallets/${walletId}/portfolio`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });
});
