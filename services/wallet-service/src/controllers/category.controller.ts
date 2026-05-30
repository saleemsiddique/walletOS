import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import * as categoryService from '../services/category.service';
import { createCategorySchema } from '../validators/category.validators';

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

async function handleCreate(req: Request, res: Response): Promise<void> {
  const input = createCategorySchema.parse(req.body);
  const result = await categoryService.createCategory(req.userId, input);
  res.status(201).json(result);
}

export const createCategory: RequestHandler = (req, res, next) => {
  handleCreate(req, res).catch(next);
};
