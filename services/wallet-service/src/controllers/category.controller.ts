import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import * as categoryService from '../services/category.service';

const listQuerySchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
});

async function handleList(req: Request, res: Response): Promise<void> {
  const { type } = listQuerySchema.parse(req.query);
  const result = await categoryService.listCategories(req.userId, type);
  res.json(result);
}

export const listCategories: RequestHandler = (req, res, next) => {
  handleList(req, res).catch(next);
};
