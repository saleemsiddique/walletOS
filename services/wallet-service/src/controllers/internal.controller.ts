import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import * as internalService from '../services/internal.service';

const transactionsQuerySchema = z.object({
  user_id: z.string().uuid(),
  from: z.string().date(),
  to: z.string().date(),
});

const categoriesQuerySchema = z.object({ user_id: z.string().uuid() });

async function handleTransactions(req: Request, res: Response): Promise<void> {
  const query = transactionsQuerySchema.parse(req.query);
  const result = await internalService.listUserTransactionsInternal(
    query.user_id,
    query.from,
    query.to,
  );
  res.json(result);
}

export const listInternalTransactions: RequestHandler = (req, res, next) => {
  handleTransactions(req, res).catch(next);
};

async function handleCategories(req: Request, res: Response): Promise<void> {
  const query = categoriesQuerySchema.parse(req.query);
  const result = await internalService.listUserCategoriesInternal(query.user_id);
  res.json(result);
}

export const listInternalCategories: RequestHandler = (req, res, next) => {
  handleCategories(req, res).catch(next);
};
