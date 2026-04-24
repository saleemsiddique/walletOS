import type { ErrorRequestHandler } from 'express';

// Minimal error handler for Rama 1. Full implementation with AppError
// classes (ValidationError, UnauthorizedError, etc.) comes in Rama 3.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const isDev = process.env['NODE_ENV'] !== 'production';

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev && err instanceof Error ? err.message : 'Internal server error',
    },
  });
};
