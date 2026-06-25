import os

# Valores de test para que `Settings` cargue al importar los módulos de la app.
# DATABASE_URL apunta a la instancia postgres-ai de test; en local se exporta con
# la contraseña real, en CI la define el job. El resto son placeholders inertes.
_TEST_ENV = {
    "DATABASE_URL": "postgresql+asyncpg://walletos:test@localhost:5433/walletos_ai",
    "REDIS_URL": "redis://localhost:6379",
    "RABBITMQ_URL": "amqp://walletos:test@localhost:5672",
    "INTERNAL_SECRET": "test-internal-secret",
    "JWT_SECRET": "test-jwt-secret",
    "WALLET_SERVICE_URL": "http://localhost:3002",
    "USER_SERVICE_URL": "http://localhost:3001",
    "OPENAI_API_KEY": "sk-test",
    "AWS_REGION": "eu-west-1",
    "AWS_ACCESS_KEY_ID": "test",
    "AWS_SECRET_ACCESS_KEY": "test",
    "AWS_S3_BUCKET": "walletos-exports-test",
}

for key, value in _TEST_ENV.items():
    os.environ.setdefault(key, value)
