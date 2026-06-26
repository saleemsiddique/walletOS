import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

async function seedNotification(userId: string, overrides: { read_at?: Date } = {}) {
  return prisma.notification.create({
    data: {
      user_id: userId,
      type: 'reminder',
      title: 'Recordatorio',
      body: '¿Has anotado tus gastos de hoy?',
      ...overrides,
    },
  });
}

describe('GET /notifications', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).get('/notifications');
    expect(res.status).toBe(401);
  });

  it('returns empty list and zero unread_count for new user', async () => {
    const res = await request(createApp())
      .get('/notifications')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ notifications: [], unread_count: 0, next_cursor: null });
  });

  it('returns notifications ordered by created_at desc', async () => {
    await seedNotification(USER_A);
    await seedNotification(USER_A);

    const res = await request(createApp())
      .get('/notifications')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(200);
    const { notifications } = res.body as { notifications: { created_at: string }[] };
    expect(notifications).toHaveLength(2);
    expect(new Date(notifications[0]!.created_at).getTime()).toBeGreaterThanOrEqual(
      new Date(notifications[1]!.created_at).getTime(),
    );
  });

  it('counts only unread notifications', async () => {
    await seedNotification(USER_A);
    await seedNotification(USER_A, { read_at: new Date() });

    const res = await request(createApp())
      .get('/notifications')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.body.unread_count).toBe(1);
  });

  it('isolates notifications by user', async () => {
    await seedNotification(USER_A);
    await seedNotification(USER_B);

    const res = await request(createApp())
      .get('/notifications')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.body.notifications).toHaveLength(1);
  });

  it('paginates with cursor and returns next_cursor when more exist', async () => {
    for (let i = 0; i < 3; i++) await seedNotification(USER_A);

    const firstPage = await request(createApp())
      .get('/notifications?limit=2')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(firstPage.body.notifications).toHaveLength(2);
    expect(firstPage.body.next_cursor).not.toBeNull();

    const cursor = firstPage.body.next_cursor as string;
    const secondPage = await request(createApp())
      .get(`/notifications?limit=2&cursor=${encodeURIComponent(cursor)}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(secondPage.body.notifications).toHaveLength(1);
    expect(secondPage.body.next_cursor).toBeNull();
  });
});

describe('PATCH /notifications/:id/read', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).patch(
      '/notifications/00000000-0000-0000-0000-000000000001/read',
    );
    expect(res.status).toBe(401);
  });

  it('marks notification as read and returns it', async () => {
    const notif = await seedNotification(USER_A);

    const res = await request(createApp())
      .patch(`/notifications/${notif.id}/read`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(200);
    expect(res.body.read_at).not.toBeNull();
  });

  it('404 when notification belongs to another user', async () => {
    const notif = await seedNotification(USER_B);

    const res = await request(createApp())
      .patch(`/notifications/${notif.id}/read`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /notifications/read-all', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).post('/notifications/read-all');
    expect(res.status).toBe(401);
  });

  it('marks all unread notifications of the user as read', async () => {
    await seedNotification(USER_A);
    await seedNotification(USER_A);

    const res = await request(createApp())
      .post('/notifications/read-all')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(204);

    const unread = await prisma.notification.count({
      where: { user_id: USER_A, read_at: null },
    });
    expect(unread).toBe(0);
  });

  it('does not affect notifications of other users', async () => {
    await seedNotification(USER_A);
    await seedNotification(USER_B);

    await request(createApp())
      .post('/notifications/read-all')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    const unread = await prisma.notification.count({
      where: { user_id: USER_B, read_at: null },
    });
    expect(unread).toBe(1);
  });
});
