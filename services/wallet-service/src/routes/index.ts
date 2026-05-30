import { Router } from 'express';
import { healthRouter } from './health.routes';
import { categoryRouter } from './category.routes';
import { bankRouter } from './bank.routes';
import { walletRouter } from './wallet.routes';
import { transactionRouter } from './transaction.routes';
import { transferRouter } from './transfer.routes';

export const router = Router();

router.use(healthRouter);
router.use(categoryRouter);
router.use(bankRouter);
router.use(walletRouter);
router.use(transactionRouter);
router.use(transferRouter);
