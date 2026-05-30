import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import * as investmentService from '../services/investment-transaction.service';
import {
  createInvestmentTransactionSchema,
  listInvestmentTransactionsSchema,
} from '../validators/investment-transaction.validators';

const walletIdParamSchema = z.object({ id: z.string().uuid() });
const investmentIdParamSchema = z.object({ id: z.string().uuid() });

async function handleCreate(req: Request, res: Response): Promise<void> {
  const { id: walletId } = walletIdParamSchema.parse(req.params);
  const input = createInvestmentTransactionSchema.parse(req.body);
  const result = await investmentService.createInvestmentTransaction(req.userId, walletId, input);
  res.status(201).json(result);
}

export const createInvestmentTransaction: RequestHandler = (req, res, next) => {
  handleCreate(req, res).catch(next);
};

async function handleList(req: Request, res: Response): Promise<void> {
  const { id: walletId } = walletIdParamSchema.parse(req.params);
  const query = listInvestmentTransactionsSchema.parse(req.query);
  const result = await investmentService.listInvestmentTransactions(req.userId, walletId, query);
  res.json(result);
}

export const listInvestmentTransactions: RequestHandler = (req, res, next) => {
  handleList(req, res).catch(next);
};

async function handleDelete(req: Request, res: Response): Promise<void> {
  const { id } = investmentIdParamSchema.parse(req.params);
  await investmentService.deleteInvestmentTransaction(req.userId, id);
  res.status(204).send();
}

export const deleteInvestmentTransaction: RequestHandler = (req, res, next) => {
  handleDelete(req, res).catch(next);
};
