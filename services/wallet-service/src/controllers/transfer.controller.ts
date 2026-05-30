import type { Request, Response, RequestHandler } from 'express';
import * as transferService from '../services/transfer.service';
import { createTransferSchema } from '../validators/transfer.validators';

async function handleCreate(req: Request, res: Response): Promise<void> {
  const input = createTransferSchema.parse(req.body);
  const result = await transferService.createTransfer(req.userId, input);
  res.status(201).json(result);
}

export const createTransfer: RequestHandler = (req, res, next) => {
  handleCreate(req, res).catch(next);
};
