import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import {
  createTransaction,
  listWalletTransactions,
} from '../controllers/transaction.controller';

const transactionLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const transactionRouter = Router();

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
