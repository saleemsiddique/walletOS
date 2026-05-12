export default {
  '*.md': 'prettier --write --no-error-on-unmatched-pattern',
  'services/user-service/**/*.ts': () => [
    'npm run lint --prefix services/user-service',
    'npm run typecheck --prefix services/user-service',
  ],
};
