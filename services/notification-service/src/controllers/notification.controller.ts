import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import { listNotificationsSchema } from '../validators/notification.validators';
import { NotFoundError } from '../middleware/errorHandler';
import * as notificationService from '../services/notification.service';

const idParamSchema = z.object({ id: z.string().uuid() });

async function handleList(req: Request, res: Response): Promise<void> {
  const query = listNotificationsSchema.parse(req.query);
  const result = await notificationService.listNotifications(req.userId, query);
  res.json(result);
}

export const listNotifications: RequestHandler = (req, res, next) => {
  handleList(req, res).catch(next);
};

async function handleMarkRead(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const result = await notificationService.markOneRead(req.userId, id);
  if (!result) throw new NotFoundError('Notification not found');
  res.json(result);
}

export const markNotificationRead: RequestHandler = (req, res, next) => {
  handleMarkRead(req, res).catch(next);
};

async function handleMarkAllRead(req: Request, res: Response): Promise<void> {
  await notificationService.markAllRead(req.userId);
  res.status(204).send();
}

export const markAllNotificationsRead: RequestHandler = (req, res, next) => {
  handleMarkAllRead(req, res).catch(next);
};
