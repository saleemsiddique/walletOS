import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import * as transactionService from '../services/transaction.service';
import {
  createTransactionSchema,
  listTransactionsSchema,
} from '../validators/transaction.validators';

const walletIdParamSchema = z.object({ id: z.string().uuid() });

async function handleCreate(req: Request, res: Response): Promise<void> {
  const { id: walletId } = walletIdParamSchema.parse(req.params);
  const input = createTransactionSchema.parse(req.body);
  const result = await transactionService.createTransaction(req.userId, walletId, input);
  res.status(201).json(result);
}

export const createTransaction: RequestHandler = (req, res, next) => {
  handleCreate(req, res).catch(next);
};

async function handleListByWallet(req: Request, res: Response): Promise<void> {
  const { id: walletId } = walletIdParamSchema.parse(req.params);
  const query = listTransactionsSchema.parse(req.query);
  const result = await transactionService.listWalletTransactions(req.userId, walletId, query);
  res.json(result);
}

export const listWalletTransactions: RequestHandler = (req, res, next) => {
  handleListByWallet(req, res).catch(next);
};
