import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import * as transactionService from '../services/transaction.service';
import {
  createTransactionSchema,
  listTransactionsSchema,
  updateTransactionSchema,
} from '../validators/transaction.validators';

const walletIdParamSchema = z.object({ id: z.string().uuid() });
const transactionIdParamSchema = z.object({ id: z.string().uuid() });

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

async function handleGet(req: Request, res: Response): Promise<void> {
  const { id } = transactionIdParamSchema.parse(req.params);
  const result = await transactionService.getTransaction(req.userId, id);
  res.json(result);
}

export const getTransaction: RequestHandler = (req, res, next) => {
  handleGet(req, res).catch(next);
};

async function handleUpdate(req: Request, res: Response): Promise<void> {
  const { id } = transactionIdParamSchema.parse(req.params);
  const input = updateTransactionSchema.parse(req.body);
  const result = await transactionService.updateTransaction(req.userId, id, input);
  res.json(result);
}

export const updateTransaction: RequestHandler = (req, res, next) => {
  handleUpdate(req, res).catch(next);
};

async function handleDelete(req: Request, res: Response): Promise<void> {
  const { id } = transactionIdParamSchema.parse(req.params);
  await transactionService.deleteTransaction(req.userId, id);
  res.status(204).send();
}

export const deleteTransaction: RequestHandler = (req, res, next) => {
  handleDelete(req, res).catch(next);
};

async function handleListAll(req: Request, res: Response): Promise<void> {
  const query = listTransactionsSchema.parse(req.query);
  const result = await transactionService.listUserTransactions(req.userId, query);
  res.json(result);
}

export const listUserTransactions: RequestHandler = (req, res, next) => {
  handleListAll(req, res).catch(next);
};
