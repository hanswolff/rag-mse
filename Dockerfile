# syntax=docker/dockerfile:1.4
FROM node:22 AS base

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable \
  && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
COPY scripts/check-node-version.js ./scripts/check-node-version.js

RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY . .

RUN pnpm exec prisma generate \
  && pnpm run build:scripts \
  && pnpm run build

FROM node:22 AS runner

WORKDIR /app

ARG APP_UID=1000
ARG APP_GID=1000

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/data/dev.db"

COPY --chown=${APP_UID}:${APP_GID} --from=builder /app/.next/standalone ./
COPY --chown=${APP_UID}:${APP_GID} --from=builder /app/.next/static ./.next/static
COPY --chown=${APP_UID}:${APP_GID} --from=builder /app/public ./public
COPY --chown=${APP_UID}:${APP_GID} --from=builder /app/emails ./emails
COPY --chown=${APP_UID}:${APP_GID} --from=builder /app/prisma ./prisma
COPY --chown=${APP_UID}:${APP_GID} --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --chown=${APP_UID}:${APP_GID} --from=builder /app/scripts-dist ./scripts-dist
COPY --chown=${APP_UID}:${APP_GID} --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh

USER ${APP_UID}:${APP_GID}

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["/app/docker-entrypoint.sh"]
