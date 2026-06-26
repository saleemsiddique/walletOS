import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notification.controller';

const notifLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const notificationRouter = Router();

notificationRouter.get('/notifications', authenticate, notifLimiter, listNotifications);
notificationRouter.patch('/notifications/:id/read', authenticate, notifLimiter, markNotificationRead);
notificationRouter.post('/notifications/read-all', authenticate, notifLimiter, markAllNotificationsRead);
