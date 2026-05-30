# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

RUN npx prisma generate

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src/

RUN npm run build

# ── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

COPY --from=builder /app/dist ./dist/

RUN apk add --no-cache curl

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3001

HEALTHCHECK CMD curl --fail http://localhost:${PORT:-3001}/health || exit 1

CMD ["node", "dist/server.js"]
