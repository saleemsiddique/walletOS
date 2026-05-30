import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import * as categoryService from '../services/category.service';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validators';

const idParamSchema = z.object({ id: z.string().uuid() });

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

async function handleUpdate(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const input = updateCategorySchema.parse(req.body);
  const result = await categoryService.updateCategory(req.userId, id, input);
  res.json(result);
}

export const updateCategory: RequestHandler = (req, res, next) => {
  handleUpdate(req, res).catch(next);
};

async function handleDelete(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  await categoryService.deleteCategory(req.userId, id);
  res.status(204).send();
}

export const deleteCategory: RequestHandler = (req, res, next) => {
  handleDelete(req, res).catch(next);
};
