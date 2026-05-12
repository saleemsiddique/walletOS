process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3099';

process.env['DATABASE_URL'] ??= 'postgresql://walletos:test@localhost:5432/walletos_wallets';
process.env['REDIS_URL'] ??= 'redis://localhost:6379';
process.env['RABBITMQ_URL'] ??= 'amqp://walletos:test@localhost:5672';

process.env['JWT_SECRET'] ||= 'test-jwt-secret-minimum-32-characters-long!!';
process.env['INTERNAL_SECRET'] ||= 'test-internal-secret-minimum-32-chars!!';
