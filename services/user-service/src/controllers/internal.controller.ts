import type { Request, Response, RequestHandler } from 'express';
import * as userService from '../services/user.service';

async function handleGetInternalUser(req: Request, res: Response): Promise<void> {
  const { id = '' } = req.params;
  const result = await userService.getInternalUser(id);
  res.json(result);
}

export const getInternalUser: RequestHandler = (req, res, next) => {
  handleGetInternalUser(req, res).catch(next);
};

async function handleListInternalUsers(req: Request, res: Response): Promise<void> {
  const timezone = typeof req.query.timezone === 'string' ? req.query.timezone : undefined;
  const raw = req.query.reminder_enabled;
  const reminder_enabled = raw === 'true' ? true : raw === 'false' ? false : undefined;
  const result = await userService.listInternalUsers({
    ...(timezone !== undefined && { timezone }),
    ...(reminder_enabled !== undefined && { reminder_enabled }),
  });
  res.json(result);
}

export const listInternalUsers: RequestHandler = (req, res, next) => {
  handleListInternalUsers(req, res).catch(next);
};
