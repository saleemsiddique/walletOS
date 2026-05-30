import { Router } from 'express';
import { internalAuth } from '../middleware/internalAuth';
import {
  listInternalTransactions,
  listInternalCategories,
} from '../controllers/internal.controller';

export const internalRouter = Router();

internalRouter.get('/internal/transactions', internalAuth, listInternalTransactions);
internalRouter.get('/internal/categories', internalAuth, listInternalCategories);
