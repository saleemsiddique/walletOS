import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { router } from './routes/index';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  app.use(helmet());

  app.use(
    cors({
      origin: env.NODE_ENV === 'production' ? [] : '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Secret'],
    }),
  );

  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        ...(env.NODE_ENV === 'development' && {
          transport: { target: 'pino-pretty', options: { colorize: true } },
        }),
        redact: ['req.headers.authorization', 'req.body.password', 'req.body.new_password'],
      }),
    );
  }

  app.use(express.json({ limit: '10kb' }));

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.use('/', router);
  app.use(errorHandler);

  return app;
}
