import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type BankItem = {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type WalletItem = {
  id: string;
  name: string;
  icon: string;
  color: string;
  balance: number;
};

type BankWithWalletsItem = {
  id: string;
  name: string;
  icon: string;
  color: string;
  wallets: WalletItem[];
  total_balance: number;
};

type ListBody = { banks: BankWithWalletsItem[]; total_balance: number };

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';

describe('POST /banks', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).post('/banks').send({ name: 'Santander' });
    expect(res.status).toBe(401);
  });

  it('201 creates bank with provided icon and color', async () => {
    const res = await request(createApp())
      .post('/banks')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Santander', icon: '🏦', color: '#E31837' });

    expect(res.status).toBe(201);
    const body = res.body as BankItem;
    expect(body).toMatchObject({
      name: 'Santander',
      icon: '🏦',
      color: '#E31837',
      is_archived: false,
    });
    expect(typeof body.id).toBe('string');
  });

  it('201 applies defaults icon=🏦 color=#007AFF when omitted', async () => {
    const res = await request(createApp())
      .post('/banks')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'BBVA' });

    expect(res.status).toBe(201);
    const body = res.body as BankItem;
    expect(body).toMatchObject({ name: 'BBVA', icon: '🏦', color: '#007AFF' });
  });

  it('400 with invalid body (missing name)', async () => {
    const res = await request(createApp())
      .post('/banks')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ icon: '🏦' });

    expect(res.status).toBe(400);
  });
});

describe('GET /banks', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).get('/banks');
    expect(res.status).toBe(401);
  });

  it('200 returns only non-archived banks of authenticated user with computed balances', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    const wallet = await prisma.wallet.create({
      data: {
        user_id: USER_A,
        bank_id: bank.id,
        name: 'Ahorro',
        initial_balance: '1000.00',
      },
    });
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'INCOME',
          amount: '500.00',
          date: new Date('2026-05-10'),
        },
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'EXPENSE',
          amount: '200.00',
          date: new Date('2026-05-12'),
        },
      ],
    });

    const archived = await prisma.bank.create({
      data: { user_id: USER_A, name: 'Viejo', is_archived: true },
    });
    expect(archived.is_archived).toBe(true);

    const res = await request(createApp())
      .get('/banks')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(res.status).toBe(200);
    expect(body.banks).toHaveLength(1);
    expect(body.banks[0]?.name).toBe('Santander');
    expect(body.banks[0]?.wallets).toHaveLength(1);
    expect(body.banks[0]?.wallets[0]).toMatchObject({ name: 'Ahorro', balance: 1300 });
    expect(body.banks[0]?.total_balance).toBe(1300);
    expect(body.total_balance).toBe(1300);
  });

  it('200 sums multiple wallets per bank into total_balance', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'BBVA' } });
    await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'A', initial_balance: '300.00' },
    });
    await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'B', initial_balance: '200.50' },
    });

    const res = await request(createApp())
      .get('/banks')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(body.banks[0]?.total_balance).toBe(500.5);
    expect(body.total_balance).toBe(500.5);
  });

  it('does not include archived wallets in balance', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Caixa' } });
    await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Activa', initial_balance: '100.00' },
    });
    await prisma.wallet.create({
      data: {
        user_id: USER_A,
        bank_id: bank.id,
        name: 'Archivada',
        initial_balance: '900.00',
        is_archived: true,
      },
    });

    const res = await request(createApp())
      .get('/banks')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(body.banks[0]?.wallets).toHaveLength(1);
    expect(body.banks[0]?.total_balance).toBe(100);
  });

  it('does not return banks of other users', async () => {
    await prisma.bank.create({ data: { user_id: USER_B, name: 'BancoOtro' } });

    const res = await request(createApp())
      .get('/banks')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(body.banks).toHaveLength(0);
    expect(body.total_balance).toBe(0);
  });
});
