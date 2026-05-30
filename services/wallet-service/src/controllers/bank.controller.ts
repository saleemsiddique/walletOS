import type { Request, Response, RequestHandler } from 'express';
import * as bankService from '../services/bank.service';
import { createBankSchema } from '../validators/bank.validators';

async function handleCreate(req: Request, res: Response): Promise<void> {
  const input = createBankSchema.parse(req.body);
  const result = await bankService.createBank(req.userId, input);
  res.status(201).json(result);
}

export const createBank: RequestHandler = (req, res, next) => {
  handleCreate(req, res).catch(next);
};
