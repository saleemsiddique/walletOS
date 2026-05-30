import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import { createWallet } from '../controllers/wallet.controller';

const walletLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const walletRouter = Router();

walletRouter.post('/banks/:id/wallets', authenticate, walletLimiter, createWallet);
