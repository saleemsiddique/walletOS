export default {
  '*.md': 'prettier --write --no-error-on-unmatched-pattern',
  'services/user-service/**/*.ts': () => [
    'npm run lint --prefix services/user-service',
    'npm run typecheck --prefix services/user-service',
  ],
  'services/wallet-service/**/*.ts': () => [
    'npm run lint --prefix services/wallet-service',
    'npm run typecheck --prefix services/wallet-service',
  ],
  'services/ai-service/**/*.py': () => [
    'uv run --project services/ai-service ruff check --fix services/ai-service',
  ],
  'services/notification-service/**/*.ts': () => [
    'npm run lint --prefix services/notification-service',
    'npm run typecheck --prefix services/notification-service',
  ],
};
