import type { Request, Response, RequestHandler } from 'express';
import * as authService from '../services/auth.service';
import { registerSchema } from '../validators/auth.validators';

async function handleRegister(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const result = await authService.register(input);
  res.status(201).json(result);
}

export const register: RequestHandler = (req, res, next) => {
  handleRegister(req, res).catch(next);
};
