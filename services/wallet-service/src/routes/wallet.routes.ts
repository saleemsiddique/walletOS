import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import { createWallet, listWalletsByBank } from '../controllers/wallet.controller';

const walletLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const walletRouter = Router();

walletRouter.get('/banks/:id/wallets', authenticate, walletLimiter, listWalletsByBank);
walletRouter.post('/banks/:id/wallets', authenticate, walletLimiter, createWallet);
