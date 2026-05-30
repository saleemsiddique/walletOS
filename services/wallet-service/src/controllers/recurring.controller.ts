import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import * as recurringService from '../services/recurring.service';
import {
  createRecurringSchema,
  updateRecurringSchema,
} from '../validators/recurring.validators';

const idParamSchema = z.object({ id: z.string().uuid() });

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

async function handleUpdate(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const input = updateRecurringSchema.parse(req.body);
  const result = await recurringService.updateRecurring(req.userId, id, input);
  res.json(result);
}

export const updateRecurring: RequestHandler = (req, res, next) => {
  handleUpdate(req, res).catch(next);
};

async function handleDelete(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  await recurringService.deleteRecurring(req.userId, id);
  res.status(204).send();
}

export const deleteRecurring: RequestHandler = (req, res, next) => {
  handleDelete(req, res).catch(next);
};
