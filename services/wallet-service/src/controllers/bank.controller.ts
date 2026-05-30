import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import * as bankService from '../services/bank.service';
import { createBankSchema, updateBankSchema } from '../validators/bank.validators';

const idParamSchema = z.object({ id: z.string().uuid() });

async function handleList(req: Request, res: Response): Promise<void> {
  const result = await bankService.listBanks(req.userId);
  res.json(result);
}

export const listBanks: RequestHandler = (req, res, next) => {
  handleList(req, res).catch(next);
};

async function handleCreate(req: Request, res: Response): Promise<void> {
  const input = createBankSchema.parse(req.body);
  const result = await bankService.createBank(req.userId, input);
  res.status(201).json(result);
}

export const createBank: RequestHandler = (req, res, next) => {
  handleCreate(req, res).catch(next);
};

async function handleUpdate(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const input = updateBankSchema.parse(req.body);
  const result = await bankService.updateBank(req.userId, id, input);
  res.json(result);
}

export const updateBank: RequestHandler = (req, res, next) => {
  handleUpdate(req, res).catch(next);
};

async function handleArchive(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const result = await bankService.archiveBank(req.userId, id);
  res.json(result);
}

export const archiveBank: RequestHandler = (req, res, next) => {
  handleArchive(req, res).catch(next);
};
