import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type InvestmentItem = {
  id: string;
  wallet_id: string;
  ticker: string;
  asset_name: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  shares: string;
  price_per_share: string;
  total_amount: string;
  currency: string;
  note: string | null;
  date: string;
};

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';
const VALID_UUID = '00000000-0000-0000-0000-000000000abc';

async function makeInvestmentWallet(userId: string): Promise<string> {
  const bank = await prisma.bank.create({ data: { user_id: userId, name: 'Broker' } });
  const wallet = await prisma.wallet.create({
    data: {
      user_id: userId,
      bank_id: bank.id,
      name: 'Cartera',
      type: 'INVESTMENT',
    },
  });
  return wallet.id;
}

async function makeCashWallet(userId: string): Promise<string> {
  const bank = await prisma.bank.create({ data: { user_id: userId, name: 'Santander' } });
  const wallet = await prisma.wallet.create({
    data: { user_id: userId, bank_id: bank.id, name: 'Nómina', type: 'CASH' },
  });
  return wallet.id;
}

describe('POST /wallets/:id/investment-transactions', () => {
  it('401 without token', async () => {
    const res = await request(createApp())
      .post(`/wallets/${VALID_UUID}/investment-transactions`)
      .send({ ticker: 'VWCE', asset_name: 'x', type: 'BUY', shares: 1, price_per_share: 1 });
    expect(res.status).toBe(401);
  });

  it('201 creates BUY operation with total_amount computed server-side', async () => {
    const walletId = await makeInvestmentWallet(USER_A);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/investment-transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        ticker: 'VWCE',
        asset_name: 'Vanguard FTSE All-World ETF',
        type: 'BUY',
        shares: 10,
        price_per_share: 87.5,
        currency: 'EUR',
        note: 'Primera compra',
        date: '2026-01-15',
      });

    expect(res.status).toBe(201);
    const body = res.body as InvestmentItem;
    expect(body).toMatchObject({
      ticker: 'VWCE',
      asset_name: 'Vanguard FTSE All-World ETF',
      type: 'BUY',
      currency: 'EUR',
      note: 'Primera compra',
      date: '2026-01-15',
    });
    expect(Number(body.total_amount)).toBe(875);
    expect(Number(body.shares)).toBe(10);
    expect(Number(body.price_per_share)).toBe(87.5);
  });

  it('201 creates SELL operation', async () => {
    const walletId = await makeInvestmentWallet(USER_A);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/investment-transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        ticker: 'VWCE',
        asset_name: 'Vanguard',
        type: 'SELL',
        shares: 5,
        price_per_share: 90,
      });

    expect(res.status).toBe(201);
    expect((res.body as InvestmentItem).type).toBe('SELL');
    expect(Number((res.body as InvestmentItem).total_amount)).toBe(450);
  });

  it('201 creates DIVIDEND operation', async () => {
    const walletId = await makeInvestmentWallet(USER_A);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/investment-transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        ticker: 'VWCE',
        asset_name: 'Vanguard',
        type: 'DIVIDEND',
        shares: 10,
        price_per_share: 0.5,
      });

    expect(res.status).toBe(201);
    expect((res.body as InvestmentItem).type).toBe('DIVIDEND');
    expect(Number((res.body as InvestmentItem).total_amount)).toBe(5);
  });

  it('defaults date to today when omitted', async () => {
    const walletId = await makeInvestmentWallet(USER_A);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/investment-transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ ticker: 'X', asset_name: 'Y', type: 'BUY', shares: 1, price_per_share: 1 });

    const today = new Date().toISOString().slice(0, 10);
    expect((res.body as InvestmentItem).date).toBe(today);
  });

  it('400 with shares <= 0', async () => {
    const walletId = await makeInvestmentWallet(USER_A);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/investment-transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ ticker: 'X', asset_name: 'Y', type: 'BUY', shares: 0, price_per_share: 1 });

    expect(res.status).toBe(400);
  });

  it('400 when wallet is of type CASH', async () => {
    const walletId = await makeCashWallet(USER_A);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/investment-transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ ticker: 'X', asset_name: 'Y', type: 'BUY', shares: 1, price_per_share: 1 });

    expect(res.status).toBe(400);
  });

  it('404 with non-existing wallet', async () => {
    const res = await request(createApp())
      .post(`/wallets/${VALID_UUID}/investment-transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ ticker: 'X', asset_name: 'Y', type: 'BUY', shares: 1, price_per_share: 1 });

    expect(res.status).toBe(404);
  });

  it('404 with wallet of another user', async () => {
    const walletId = await makeInvestmentWallet(USER_B);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/investment-transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ ticker: 'X', asset_name: 'Y', type: 'BUY', shares: 1, price_per_share: 1 });

    expect(res.status).toBe(404);
  });
});
