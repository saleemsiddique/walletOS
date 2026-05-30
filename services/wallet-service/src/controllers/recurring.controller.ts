import type { Request, Response, RequestHandler } from 'express';
import * as recurringService from '../services/recurring.service';
import { createRecurringSchema } from '../validators/recurring.validators';

async function handleList(req: Request, res: Response): Promise<void> {
  const result = await recurringService.listRecurring(req.userId);
  res.json(result);
}

export const listRecurring: RequestHandler = (req, res, next) => {
  handleList(req, res).catch(next);
};

async function handleCreate(req: Request, res: Response): Promise<void> {
  const input = createRecurringSchema.parse(req.body);
  const result = await recurringService.createRecurring(req.userId, input);
  res.status(201).json(result);
}

export const createRecurring: RequestHandler = (req, res, next) => {
  handleCreate(req, res).catch(next);
};
