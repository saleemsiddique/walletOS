export default {
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
