import type { Request, Response, RequestHandler } from 'express';
import * as authService from '../services/auth.service';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from '../validators/auth.validators';

async function handleRegister(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const result = await authService.register(input);
  res.status(201).json(result);
}

export const register: RequestHandler = (req, res, next) => {
  handleRegister(req, res).catch(next);
};

async function handleLogin(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input);
  res.json(result);
}

export const login: RequestHandler = (req, res, next) => {
  handleLogin(req, res).catch(next);
};

async function handleRefresh(req: Request, res: Response): Promise<void> {
  const input = refreshSchema.parse(req.body);
  const result = await authService.refresh(input);
  res.json(result);
}

export const refresh: RequestHandler = (req, res, next) => {
  handleRefresh(req, res).catch(next);
};

async function handleLogout(req: Request, res: Response): Promise<void> {
  const input = logoutSchema.parse(req.body);
  await authService.logout(input);
  res.status(204).send();
}

export const logout: RequestHandler = (req, res, next) => {
  handleLogout(req, res).catch(next);
};
