process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3099';

process.env['DATABASE_URL'] ??= 'postgresql://walletos:test@localhost:5432/walletos_notifications';
process.env['REDIS_URL'] ??= 'redis://localhost:6379';
process.env['RABBITMQ_URL'] ??= 'amqp://walletos:test@localhost:5672';

process.env['JWT_SECRET'] ||= 'test-jwt-secret-minimum-32-characters-long!!';
process.env['INTERNAL_SECRET'] ||= 'test-internal-secret-minimum-32-chars!!';
process.env['USER_SERVICE_URL'] ||= 'http://localhost:3001';

process.env['APNS_KEY_ID'] ||= 'TESTKEY1234';
process.env['APNS_TEAM_ID'] ||= 'TESTTEAM123';
process.env['APNS_BUNDLE_ID'] ||= 'com.walletOS.app';
process.env['APNS_ENV'] ||= 'sandbox';
process.env['APNS_KEY'] ||= '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----';
