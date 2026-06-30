// Commits previos de la Fase 9 con scope `phase-9` (fuera del enum) o header >100 chars,
// anteriores a la consolidación del scope-enum. No se reescriben porque `develop` es rama
// protegida (sin force-push). Los nuevos commits sí cumplen las reglas.
const legacyPhase9Headers = [
  'docs(phase-9): crear phase-9-nginx-e2e.md — nginx, docker-compose, colección bruno y escenarios e2e',
  'docs(phase-9): añadir estructura de ramas y checkboxes al doc de fase 9',
  'docs(phase-9): colección bruno e2e — 01-auth a 10-notifications con entorno local',
  'docs(root): alinear api-contracts, phase-9 y roadmap — rutas nginx correctas, flutter→swiftui, wallet 21→31 endpoints, estado de implementación actualizado',
];

export default {
  // Squash commit de PR #14 tiene mayúsculas por error anterior al establecer lower-case como regla
  ignores: [
    (commit) => /^feat\(user-service\): Rama 2 —/.test(commit),
    (commit) => legacyPhase9Headers.some((header) => commit.startsWith(header)),
  ],
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
