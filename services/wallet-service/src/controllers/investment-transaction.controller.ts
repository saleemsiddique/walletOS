import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import * as investmentService from '../services/investment-transaction.service';
import { createInvestmentTransactionSchema } from '../validators/investment-transaction.validators';

const walletIdParamSchema = z.object({ id: z.string().uuid() });

async function handleCreate(req: Request, res: Response): Promise<void> {
  const { id: walletId } = walletIdParamSchema.parse(req.params);
  const input = createInvestmentTransactionSchema.parse(req.body);
  const result = await investmentService.createInvestmentTransaction(req.userId, walletId, input);
  res.status(201).json(result);
}

export const createInvestmentTransaction: RequestHandler = (req, res, next) => {
  handleCreate(req, res).catch(next);
};
