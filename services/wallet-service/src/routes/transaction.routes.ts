import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import {
  createTransaction,
  listWalletTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  listUserTransactions,
} from '../controllers/transaction.controller';

const transactionLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const transactionRouter = Router();

transactionRouter.get('/transactions', authenticate, transactionLimiter, listUserTransactions);
transactionRouter.get(
  '/wallets/:id/transactions',
  authenticate,
  transactionLimiter,
  listWalletTransactions,
);
transactionRouter.post(
  '/wallets/:id/transactions',
  authenticate,
  transactionLimiter,
  createTransaction,
);
transactionRouter.get('/transactions/:id', authenticate, transactionLimiter, getTransaction);
transactionRouter.patch('/transactions/:id', authenticate, transactionLimiter, updateTransaction);
transactionRouter.delete(
  '/transactions/:id',
  authenticate,
  transactionLimiter,
  deleteTransaction,
);
