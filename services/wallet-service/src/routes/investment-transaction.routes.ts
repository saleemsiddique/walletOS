import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import {
  createInvestmentTransaction,
  listInvestmentTransactions,
  deleteInvestmentTransaction,
} from '../controllers/investment-transaction.controller';

const investmentLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const investmentTransactionRouter = Router();

investmentTransactionRouter.get(
  '/wallets/:id/investment-transactions',
  authenticate,
  investmentLimiter,
  listInvestmentTransactions,
);
investmentTransactionRouter.post(
  '/wallets/:id/investment-transactions',
  authenticate,
  investmentLimiter,
  createInvestmentTransaction,
);
investmentTransactionRouter.delete(
  '/investment-transactions/:id',
  authenticate,
  investmentLimiter,
  deleteInvestmentTransaction,
);
