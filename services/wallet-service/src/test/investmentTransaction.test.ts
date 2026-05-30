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

describe('GET /wallets/:id/investment-transactions', () => {
  type ListBody = { transactions: InvestmentItem[]; next_cursor: string | null };

  it('401 without token', async () => {
    const res = await request(createApp()).get(
      `/wallets/${VALID_UUID}/investment-transactions`,
    );
    expect(res.status).toBe(401);
  });

  it('200 lists operations ordered date DESC', async () => {
    const walletId = await makeInvestmentWallet(USER_A);
    await prisma.investmentTransaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: walletId,
          ticker: 'VWCE',
          asset_name: 'Vanguard',
          type: 'BUY',
          shares: '5',
          price_per_share: '80',
          total_amount: '400',
          date: new Date('2026-01-10'),
        },
        {
          user_id: USER_A,
          wallet_id: walletId,
          ticker: 'VWCE',
          asset_name: 'Vanguard',
          type: 'BUY',
          shares: '3',
          price_per_share: '90',
          total_amount: '270',
          date: new Date('2026-01-15'),
        },
      ],
    });

    const res = await request(createApp())
      .get(`/wallets/${walletId}/investment-transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(res.status).toBe(200);
    expect(body.transactions).toHaveLength(2);
    expect(body.transactions.map((t) => t.date)).toEqual(['2026-01-15', '2026-01-10']);
    expect(body.next_cursor).toBeNull();
  });

  it('paginates with cursor', async () => {
    const walletId = await makeInvestmentWallet(USER_A);
    for (let i = 1; i <= 3; i++) {
      await prisma.investmentTransaction.create({
        data: {
          user_id: USER_A,
          wallet_id: walletId,
          ticker: 'X',
          asset_name: 'X',
          type: 'BUY',
          shares: `${i}`,
          price_per_share: '10',
          total_amount: `${i * 10}`,
          date: new Date(`2026-01-${10 + i}`),
        },
      });
    }
    const token = signToken(USER_A);

    const page1 = await request(createApp())
      .get(`/wallets/${walletId}/investment-transactions?limit=2`)
      .set('Authorization', `Bearer ${token}`);
    const body1 = page1.body as ListBody;
    expect(body1.transactions).toHaveLength(2);
    expect(body1.next_cursor).not.toBeNull();

    const page2 = await request(createApp())
      .get(
        `/wallets/${walletId}/investment-transactions?limit=2&cursor=${body1.next_cursor as string}`,
      )
      .set('Authorization', `Bearer ${token}`);
    const body2 = page2.body as ListBody;
    expect(body2.transactions).toHaveLength(1);
    expect(body2.next_cursor).toBeNull();
  });

  it('filters by ticker', async () => {
    const walletId = await makeInvestmentWallet(USER_A);
    await prisma.investmentTransaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: walletId,
          ticker: 'VWCE',
          asset_name: 'V',
          type: 'BUY',
          shares: '1',
          price_per_share: '1',
          total_amount: '1',
          date: new Date('2026-01-10'),
        },
        {
          user_id: USER_A,
          wallet_id: walletId,
          ticker: 'AAPL',
          asset_name: 'A',
          type: 'BUY',
          shares: '1',
          price_per_share: '1',
          total_amount: '1',
          date: new Date('2026-01-11'),
        },
      ],
    });

    const res = await request(createApp())
      .get(`/wallets/${walletId}/investment-transactions?ticker=VWCE`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]?.ticker).toBe('VWCE');
  });

  it('filters by type', async () => {
    const walletId = await makeInvestmentWallet(USER_A);
    await prisma.investmentTransaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: walletId,
          ticker: 'VWCE',
          asset_name: 'V',
          type: 'BUY',
          shares: '1',
          price_per_share: '1',
          total_amount: '1',
          date: new Date('2026-01-10'),
        },
        {
          user_id: USER_A,
          wallet_id: walletId,
          ticker: 'VWCE',
          asset_name: 'V',
          type: 'DIVIDEND',
          shares: '1',
          price_per_share: '0.5',
          total_amount: '0.5',
          date: new Date('2026-01-11'),
        },
      ],
    });

    const res = await request(createApp())
      .get(`/wallets/${walletId}/investment-transactions?type=DIVIDEND`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]?.type).toBe('DIVIDEND');
  });

  it('400 when wallet is of type CASH', async () => {
    const walletId = await makeCashWallet(USER_A);

    const res = await request(createApp())
      .get(`/wallets/${walletId}/investment-transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(400);
  });

  it('404 with wallet of another user', async () => {
    const walletId = await makeInvestmentWallet(USER_B);

    const res = await request(createApp())
      .get(`/wallets/${walletId}/investment-transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /investment-transactions/:id', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).delete(`/investment-transactions/${VALID_UUID}`);
    expect(res.status).toBe(401);
  });

  it('204 deletes own investment transaction', async () => {
    const walletId = await makeInvestmentWallet(USER_A);
    const tx = await prisma.investmentTransaction.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        ticker: 'VWCE',
        asset_name: 'V',
        type: 'BUY',
        shares: '1',
        price_per_share: '80',
        total_amount: '80',
        date: new Date('2026-01-10'),
      },
    });

    const res = await request(createApp())
      .delete(`/investment-transactions/${tx.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(204);
    const db = await prisma.investmentTransaction.findUnique({ where: { id: tx.id } });
    expect(db).toBeNull();
  });

  it('404 with non-existing id', async () => {
    const res = await request(createApp())
      .delete(`/investment-transactions/${VALID_UUID}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });

  it('404 with investment transaction of another user', async () => {
    const walletId = await makeInvestmentWallet(USER_B);
    const tx = await prisma.investmentTransaction.create({
      data: {
        user_id: USER_B,
        wallet_id: walletId,
        ticker: 'X',
        asset_name: 'X',
        type: 'BUY',
        shares: '1',
        price_per_share: '1',
        total_amount: '1',
        date: new Date('2026-01-10'),
      },
    });

    const res = await request(createApp())
      .delete(`/investment-transactions/${tx.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });
});
