import pino from 'pino';

export const logger = pino({
  ...(process.env['NODE_ENV'] === 'development' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
  ...(process.env['NODE_ENV'] === 'test' && { level: 'silent' }),
  redact: ['authorization', 'token', 'apnsKey'],
});
