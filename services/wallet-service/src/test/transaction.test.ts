import { vi } from 'vitest';

vi.mock('../lib/rabbitmq', () => ({
  connectRabbitMQ: vi.fn(),
  publishEvent: vi.fn(),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { seedCategories } from '../lib/seed';
import { publishEvent } from '../lib/rabbitmq';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type TransactionItem = {
  id: string;
  wallet_id: string;
  wallet_name: string;
  bank_name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: { id: string; name: string; icon: string } | null;
  note: string | null;
  date: string;
  transfer_id: string | null;
  paired_wallet_name: string | null;
  created_at: string;
};

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';
const VALID_UUID = '00000000-0000-0000-0000-000000000abc';

async function makeWallet(userId: string): Promise<{ id: string; bankId: string }> {
  const bank = await prisma.bank.create({ data: { user_id: userId, name: 'Santander' } });
  const wallet = await prisma.wallet.create({
    data: { user_id: userId, bank_id: bank.id, name: 'Ahorro', initial_balance: '0.00' },
  });
  return { id: wallet.id, bankId: bank.id };
}

describe('POST /wallets/:id/transactions', () => {
  beforeEach(async () => {
    await seedCategories();
    vi.mocked(publishEvent).mockClear();
  });

  it('401 without token', async () => {
    const res = await request(createApp())
      .post(`/wallets/${VALID_UUID}/transactions`)
      .send({ type: 'EXPENSE', amount: 10 });
    expect(res.status).toBe(401);
  });

  it('201 creates EXPENSE with server-generated id and publishes event', async () => {
    const { id: walletId, bankId } = await makeWallet(USER_A);
    const category = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Comida', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        type: 'EXPENSE',
        amount: 42.3,
        category_id: category.id,
        note: 'Mercadona',
        date: '2026-04-18',
      });

    expect(res.status).toBe(201);
    const body = res.body as TransactionItem;
    expect(body).toMatchObject({
      wallet_id: walletId,
      wallet_name: 'Ahorro',
      bank_name: 'Santander',
      type: 'EXPENSE',
      amount: 42.3,
      note: 'Mercadona',
      date: '2026-04-18',
      transfer_id: null,
      paired_wallet_name: null,
    });
    expect(body.category).toMatchObject({ id: category.id, name: 'Comida' });
    expect(typeof body.id).toBe('string');
    expect(bankId).toBeTruthy();

    expect(publishEvent).toHaveBeenCalledOnce();
    const [routingKey, payload] = vi.mocked(publishEvent).mock.calls[0] ?? [];
    expect(routingKey).toBe('transaction.created');
    expect(payload).toMatchObject({
      event: 'transaction.created',
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: 42.3,
        category_id: category.id,
        category_name: 'Comida',
        date: '2026-04-18',
        transfer_id: null,
      },
    });
  });

  it('201 creates INCOME with predefined category', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const category = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Nómina', type: 'INCOME' },
    });

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'INCOME', amount: 1500, category_id: category.id });

    expect(res.status).toBe(201);
    expect((res.body as TransactionItem).type).toBe('INCOME');
  });

  it('201 with client-provided UUID (offline-first)', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const clientId = '11111111-2222-3333-4444-555555555555';

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ id: clientId, type: 'EXPENSE', amount: 5 });

    expect(res.status).toBe(201);
    expect((res.body as TransactionItem).id).toBe(clientId);
  });

  it('409 when sent id already exists', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const clientId = '22222222-2222-3333-4444-555555555555';
    const token = signToken(USER_A);

    await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ id: clientId, type: 'EXPENSE', amount: 5 });

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ id: clientId, type: 'EXPENSE', amount: 10 });

    expect(res.status).toBe(409);
  });

  it('defaults date to today when omitted', async () => {
    const { id: walletId } = await makeWallet(USER_A);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'EXPENSE', amount: 5 });

    expect(res.status).toBe(201);
    const today = new Date().toISOString().slice(0, 10);
    expect((res.body as TransactionItem).date).toBe(today);
  });

  it('400 with amount <= 0', async () => {
    const { id: walletId } = await makeWallet(USER_A);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'EXPENSE', amount: -1 });

    expect(res.status).toBe(400);
  });

  it('400 when category type does not match transaction type', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const incomeCat = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Nómina', type: 'INCOME' },
    });

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'EXPENSE', amount: 10, category_id: incomeCat.id });

    expect(res.status).toBe(400);
  });

  it('400 with category of another user', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const otherCat = await prisma.category.create({
      data: { user_id: USER_B, name: 'SecretoB', icon: '🔒', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'EXPENSE', amount: 10, category_id: otherCat.id });

    expect(res.status).toBe(400);
  });

  it('404 with non-existing wallet', async () => {
    const res = await request(createApp())
      .post(`/wallets/${VALID_UUID}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'EXPENSE', amount: 10 });

    expect(res.status).toBe(404);
  });

  it('404 with wallet of another user', async () => {
    const { id: walletId } = await makeWallet(USER_B);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'EXPENSE', amount: 10 });

    expect(res.status).toBe(404);
  });
});

describe('GET /wallets/:id/transactions', () => {
  beforeEach(async () => {
    await seedCategories();
  });

  type ListBody = { transactions: TransactionItem[]; next_cursor: string | null };

  it('401 without token', async () => {
    const res = await request(createApp()).get(`/wallets/${VALID_UUID}/transactions`);
    expect(res.status).toBe(401);
  });

  it('200 lists transactions ordered by date DESC, created_at DESC', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: walletId,
          type: 'EXPENSE',
          amount: '10.00',
          date: new Date('2026-05-10'),
        },
        {
          user_id: USER_A,
          wallet_id: walletId,
          type: 'EXPENSE',
          amount: '20.00',
          date: new Date('2026-05-12'),
        },
        {
          user_id: USER_A,
          wallet_id: walletId,
          type: 'INCOME',
          amount: '30.00',
          date: new Date('2026-05-11'),
        },
      ],
    });

    const res = await request(createApp())
      .get(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(res.status).toBe(200);
    expect(body.transactions).toHaveLength(3);
    expect(body.transactions.map((t) => t.amount)).toEqual([20, 30, 10]);
    expect(body.next_cursor).toBeNull();
  });

  it('paginates with cursor across pages', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    for (let i = 1; i <= 5; i++) {
      await prisma.transaction.create({
        data: {
          user_id: USER_A,
          wallet_id: walletId,
          type: 'EXPENSE',
          amount: `${i}.00`,
          date: new Date(`2026-05-${10 + i}`),
        },
      });
    }
    const token = signToken(USER_A);

    const page1 = await request(createApp())
      .get(`/wallets/${walletId}/transactions?limit=2`)
      .set('Authorization', `Bearer ${token}`);
    const body1 = page1.body as ListBody;

    expect(body1.transactions).toHaveLength(2);
    expect(body1.next_cursor).not.toBeNull();
    expect(body1.transactions.map((t) => t.amount)).toEqual([5, 4]);

    const page2 = await request(createApp())
      .get(`/wallets/${walletId}/transactions?limit=2&cursor=${body1.next_cursor as string}`)
      .set('Authorization', `Bearer ${token}`);
    const body2 = page2.body as ListBody;

    expect(body2.transactions).toHaveLength(2);
    expect(body2.transactions.map((t) => t.amount)).toEqual([3, 2]);
    expect(body2.next_cursor).not.toBeNull();

    const page3 = await request(createApp())
      .get(`/wallets/${walletId}/transactions?limit=2&cursor=${body2.next_cursor as string}`)
      .set('Authorization', `Bearer ${token}`);
    const body3 = page3.body as ListBody;

    expect(body3.transactions).toHaveLength(1);
    expect(body3.transactions[0]?.amount).toBe(1);
    expect(body3.next_cursor).toBeNull();
  });

  it('filters by from and to dates', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: walletId,
          type: 'EXPENSE',
          amount: '1.00',
          date: new Date('2026-04-30'),
        },
        {
          user_id: USER_A,
          wallet_id: walletId,
          type: 'EXPENSE',
          amount: '2.00',
          date: new Date('2026-05-15'),
        },
        {
          user_id: USER_A,
          wallet_id: walletId,
          type: 'EXPENSE',
          amount: '3.00',
          date: new Date('2026-06-01'),
        },
      ],
    });

    const res = await request(createApp())
      .get(`/wallets/${walletId}/transactions?from=2026-05-01&to=2026-05-31`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]?.amount).toBe(2);
  });

  it('filters by category_id', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const cat1 = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Comida', type: 'EXPENSE' },
    });
    const cat2 = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Ocio', type: 'EXPENSE' },
    });
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: walletId,
          type: 'EXPENSE',
          amount: '1.00',
          date: new Date('2026-05-10'),
          category_id: cat1.id,
        },
        {
          user_id: USER_A,
          wallet_id: walletId,
          type: 'EXPENSE',
          amount: '2.00',
          date: new Date('2026-05-11'),
          category_id: cat2.id,
        },
      ],
    });

    const res = await request(createApp())
      .get(`/wallets/${walletId}/transactions?category_id=${cat1.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]?.amount).toBe(1);
  });

  it('includes transfers with paired_wallet_name', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    const walletOrigen = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Origen', initial_balance: '100.00' },
    });
    const walletDestino = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Destino', initial_balance: '0.00' },
    });
    const transferId = '99999999-9999-9999-9999-999999999999';
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: walletOrigen.id,
          type: 'EXPENSE',
          amount: '50.00',
          date: new Date('2026-05-10'),
          transfer_id: transferId,
        },
        {
          user_id: USER_A,
          wallet_id: walletDestino.id,
          type: 'INCOME',
          amount: '50.00',
          date: new Date('2026-05-10'),
          transfer_id: transferId,
        },
      ],
    });

    const res = await request(createApp())
      .get(`/wallets/${walletOrigen.id}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]?.paired_wallet_name).toBe('Destino');
    expect(body.transactions[0]?.transfer_id).toBe(transferId);
  });

  it('404 with non-existing wallet', async () => {
    const res = await request(createApp())
      .get(`/wallets/${VALID_UUID}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });

  it('404 with wallet of another user', async () => {
    const { id: walletId } = await makeWallet(USER_B);

    const res = await request(createApp())
      .get(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /transactions/:id', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).get(`/transactions/${VALID_UUID}`);
    expect(res.status).toBe(401);
  });

  it('200 returns own transaction with relations', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const tx = await prisma.transaction.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '42.30',
        note: 'Mercadona',
        date: new Date('2026-04-18'),
      },
    });

    const res = await request(createApp())
      .get(`/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(200);
    const body = res.body as TransactionItem;
    expect(body).toMatchObject({
      id: tx.id,
      wallet_id: walletId,
      wallet_name: 'Ahorro',
      bank_name: 'Santander',
      amount: 42.3,
      note: 'Mercadona',
      date: '2026-04-18',
      transfer_id: null,
      paired_wallet_name: null,
    });
  });

  it('404 with non-existing id', async () => {
    const res = await request(createApp())
      .get(`/transactions/${VALID_UUID}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });

  it('404 with transaction of another user', async () => {
    const { id: walletId } = await makeWallet(USER_B);
    const tx = await prisma.transaction.create({
      data: {
        user_id: USER_B,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '1.00',
        date: new Date('2026-05-10'),
      },
    });

    const res = await request(createApp())
      .get(`/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /transactions/:id', () => {
  beforeEach(async () => {
    await seedCategories();
  });

  it('401 without token', async () => {
    const res = await request(createApp()).patch(`/transactions/${VALID_UUID}`).send({ amount: 1 });
    expect(res.status).toBe(401);
  });

  it('200 updates type, amount, category_id, note, date', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const expenseCat = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Comida', type: 'EXPENSE' },
    });
    const incomeCat = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Nómina', type: 'INCOME' },
    });
    const tx = await prisma.transaction.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '10.00',
        category_id: expenseCat.id,
        date: new Date('2026-04-18'),
      },
    });

    const res = await request(createApp())
      .patch(`/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        type: 'INCOME',
        amount: 50,
        category_id: incomeCat.id,
        note: 'Corregido',
        date: '2026-04-17',
      });

    expect(res.status).toBe(200);
    const body = res.body as TransactionItem;
    expect(body).toMatchObject({
      id: tx.id,
      type: 'INCOME',
      amount: 50,
      note: 'Corregido',
      date: '2026-04-17',
    });
    expect(body.category?.id).toBe(incomeCat.id);
  });

  it('200 moves transaction to another wallet of same user', async () => {
    const { id: walletId1 } = await makeWallet(USER_A);
    const wallet2 = await prisma.wallet.create({
      data: {
        user_id: USER_A,
        bank_id: (
          await prisma.bank.create({ data: { user_id: USER_A, name: 'Otro' } })
        ).id,
        name: 'WalletDestino',
      },
    });
    const tx = await prisma.transaction.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId1,
        type: 'EXPENSE',
        amount: '5.00',
        date: new Date('2026-05-10'),
      },
    });

    const res = await request(createApp())
      .patch(`/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ wallet_id: wallet2.id });

    expect(res.status).toBe(200);
    expect((res.body as TransactionItem).wallet_id).toBe(wallet2.id);
    expect((res.body as TransactionItem).wallet_name).toBe('WalletDestino');
  });

  it('403 when editing a transfer transaction', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const tx = await prisma.transaction.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '10.00',
        date: new Date('2026-05-10'),
        transfer_id: '99999999-9999-9999-9999-999999999999',
      },
    });

    const res = await request(createApp())
      .patch(`/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ amount: 20 });

    expect(res.status).toBe(403);
  });

  it('400 when new category_id type does not match transaction type', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const incomeCat = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Nómina', type: 'INCOME' },
    });
    const tx = await prisma.transaction.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '10.00',
        date: new Date('2026-05-10'),
      },
    });

    const res = await request(createApp())
      .patch(`/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ category_id: incomeCat.id });

    expect(res.status).toBe(400);
  });

  it('404 with non-existing id', async () => {
    const res = await request(createApp())
      .patch(`/transactions/${VALID_UUID}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ amount: 5 });

    expect(res.status).toBe(404);
  });

  it('404 when target wallet_id belongs to another user', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const { id: foreignWalletId } = await makeWallet(USER_B);
    const tx = await prisma.transaction.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '5.00',
        date: new Date('2026-05-10'),
      },
    });

    const res = await request(createApp())
      .patch(`/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ wallet_id: foreignWalletId });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /transactions/:id', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).delete(`/transactions/${VALID_UUID}`);
    expect(res.status).toBe(401);
  });

  it('204 deletes own transaction', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const tx = await prisma.transaction.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '5.00',
        date: new Date('2026-05-10'),
      },
    });

    const res = await request(createApp())
      .delete(`/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(204);
    const dbTx = await prisma.transaction.findUnique({ where: { id: tx.id } });
    expect(dbTx).toBeNull();
  });

  it('204 deletes both sides of a transfer atomically', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    const walletOrigen = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Origen' },
    });
    const walletDestino = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Destino' },
    });
    const transferId = '77777777-7777-7777-7777-777777777777';
    const expense = await prisma.transaction.create({
      data: {
        user_id: USER_A,
        wallet_id: walletOrigen.id,
        type: 'EXPENSE',
        amount: '50.00',
        date: new Date('2026-05-10'),
        transfer_id: transferId,
      },
    });
    const income = await prisma.transaction.create({
      data: {
        user_id: USER_A,
        wallet_id: walletDestino.id,
        type: 'INCOME',
        amount: '50.00',
        date: new Date('2026-05-10'),
        transfer_id: transferId,
      },
    });

    const res = await request(createApp())
      .delete(`/transactions/${expense.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(204);
    const remaining = await prisma.transaction.findMany({
      where: { id: { in: [expense.id, income.id] } },
    });
    expect(remaining).toHaveLength(0);
  });

  it('404 with non-existing id', async () => {
    const res = await request(createApp())
      .delete(`/transactions/${VALID_UUID}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });
});
