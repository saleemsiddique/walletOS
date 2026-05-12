export default {
  // Squash commit de PR #14 tiene mayúsculas por error anterior al establecer lower-case como regla
  ignores: [(commit) => /^feat\(user-service\): Rama 2 —/.test(commit)],
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'user-service',
        'wallet-service',
        'ai-service',
        'notification-service',
        'ios',
        'infra',
        'ci',
        'docs',
        'deps',
        'root',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
  },
};
