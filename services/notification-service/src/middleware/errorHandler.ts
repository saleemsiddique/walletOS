import type { ErrorRequestHandler } from 'express';

// Scaffold: handler genérico. La Rama 4 añade las clases AppError y el shape
// completo (validación, 401, 404, etc.).
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const isDev = process.env['NODE_ENV'] !== 'production';
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev && err instanceof Error ? err.message : 'Internal server error',
    },
  });
};
