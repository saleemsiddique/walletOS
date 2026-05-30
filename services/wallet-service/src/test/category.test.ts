import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { seedCategories } from '../lib/seed';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type CategoryItem = {
  id: string;
  name: string;
  icon: string;
  type: 'INCOME' | 'EXPENSE';
  is_custom: boolean;
};

type ListBody = { categories: CategoryItem[] };

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';

describe('GET /categories', () => {
  beforeEach(async () => {
    await seedCategories();
  });

  it('401 without token', async () => {
    const res = await request(createApp()).get('/categories');
    expect(res.status).toBe(401);
  });

  it('200 returns predefined + custom of authenticated user', async () => {
    await prisma.category.create({
      data: { user_id: USER_A, name: 'Gimnasio', icon: '💪', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .get('/categories')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(res.status).toBe(200);
    expect(body.categories).toHaveLength(15);
    expect(body.categories.find((c) => c.name === 'Gimnasio')).toMatchObject({
      name: 'Gimnasio',
      is_custom: true,
    });
  });

  it('orders predefined first, custom last', async () => {
    await prisma.category.create({
      data: { user_id: USER_A, name: 'Gimnasio', icon: '💪', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .get('/categories')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    const flags = body.categories.map((c) => c.is_custom);
    const lastPredefIndex = flags.lastIndexOf(false);
    const firstCustomIndex = flags.indexOf(true);
    expect(lastPredefIndex).toBeLessThan(firstCustomIndex);
  });

  it('filters by ?type=EXPENSE', async () => {
    const res = await request(createApp())
      .get('/categories?type=EXPENSE')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(res.status).toBe(200);
    expect(body.categories).toHaveLength(9);
    expect(body.categories.every((c) => c.type === 'EXPENSE')).toBe(true);
  });

  it('does not include custom categories of other users', async () => {
    await prisma.category.create({
      data: { user_id: USER_B, name: 'SecretoB', icon: '🔒', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .get('/categories')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(body.categories.find((c) => c.name === 'SecretoB')).toBeUndefined();
  });
});

describe('POST /categories', () => {
  beforeEach(async () => {
    await seedCategories();
  });

  it('401 without token', async () => {
    const res = await request(createApp())
      .post('/categories')
      .send({ name: 'Gimnasio', icon: '💪', type: 'EXPENSE' });
    expect(res.status).toBe(401);
  });

  it('201 creates custom category with is_custom:true', async () => {
    const res = await request(createApp())
      .post('/categories')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Gimnasio', icon: '💪', type: 'EXPENSE' });

    expect(res.status).toBe(201);
    const body = res.body as CategoryItem;
    expect(body).toMatchObject({
      name: 'Gimnasio',
      icon: '💪',
      type: 'EXPENSE',
      is_custom: true,
    });
    expect(typeof body.id).toBe('string');
  });

  it('409 with duplicated name+type for same user', async () => {
    const token = signToken(USER_A);
    await request(createApp())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Gimnasio', icon: '💪', type: 'EXPENSE' });

    const res = await request(createApp())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Gimnasio', icon: '🏋', type: 'EXPENSE' });

    expect(res.status).toBe(409);
  });

  it('400 with invalid body (missing name)', async () => {
    const res = await request(createApp())
      .post('/categories')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ icon: '💪', type: 'EXPENSE' });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /categories/:id', () => {
  beforeEach(async () => {
    await seedCategories();
  });

  const VALID_UUID = '00000000-0000-0000-0000-000000000123';

  it('401 without token', async () => {
    const res = await request(createApp())
      .patch(`/categories/${VALID_UUID}`)
      .send({ name: 'Gym' });
    expect(res.status).toBe(401);
  });

  it('200 updates name and icon of own custom category', async () => {
    const created = await prisma.category.create({
      data: { user_id: USER_A, name: 'Gimnasio', icon: '💪', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .patch(`/categories/${created.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Gym', icon: '🏋' });

    expect(res.status).toBe(200);
    const body = res.body as CategoryItem;
    expect(body).toMatchObject({ name: 'Gym', icon: '🏋', is_custom: true });
  });

  it('403 when editing a predefined category', async () => {
    const predef = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Comida' },
    });

    const res = await request(createApp())
      .patch(`/categories/${predef.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'NoPuedes' });

    expect(res.status).toBe(403);
  });

  it('404 with non-existing id', async () => {
    const res = await request(createApp())
      .patch(`/categories/${VALID_UUID}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Gym' });

    expect(res.status).toBe(404);
  });

  it('404 when editing custom category of another user', async () => {
    const otra = await prisma.category.create({
      data: { user_id: USER_B, name: 'SecretoB', icon: '🔒', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .patch(`/categories/${otra.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Robada' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /categories/:id', () => {
  beforeEach(async () => {
    await seedCategories();
  });

  const VALID_UUID = '00000000-0000-0000-0000-000000000456';

  it('401 without token', async () => {
    const res = await request(createApp()).delete(`/categories/${VALID_UUID}`);
    expect(res.status).toBe(401);
  });

  it('204 deletes own custom category and reassigns transactions to "Otros" of same type', async () => {
    const custom = await prisma.category.create({
      data: { user_id: USER_A, name: 'Gimnasio', icon: '💪', type: 'EXPENSE' },
    });
    const bank = await prisma.bank.create({
      data: { user_id: USER_A, name: 'Mi banco' },
    });
    const wallet = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Cuenta' },
    });
    const tx = await prisma.transaction.create({
      data: {
        user_id: USER_A,
        wallet_id: wallet.id,
        category_id: custom.id,
        type: 'EXPENSE',
        amount: '10.00',
        date: new Date('2026-05-30'),
      },
    });

    const res = await request(createApp())
      .delete(`/categories/${custom.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(204);

    const deleted = await prisma.category.findUnique({ where: { id: custom.id } });
    expect(deleted).toBeNull();

    const fallback = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Otros', type: 'EXPENSE' },
    });
    const reassigned = await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } });
    expect(reassigned.category_id).toBe(fallback.id);
  });

  it('403 deleting a predefined category', async () => {
    const predef = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Comida' },
    });

    const res = await request(createApp())
      .delete(`/categories/${predef.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(403);
  });

  it('404 with non-existing id', async () => {
    const res = await request(createApp())
      .delete(`/categories/${VALID_UUID}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });
});
