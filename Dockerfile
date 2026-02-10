# syntax=docker/dockerfile:1.4
FROM node:22 AS scripts-builder

WORKDIR /build

COPY scripts ./scripts
COPY tsconfig.build.json ./tsconfig.build.json

RUN npm install -g pnpm@10.0.0 \
  && printf '{ "name": "scripts-builder", "private": true }' > package.json \
  && pnpm add --save-dev typescript@5.9.3 @types/node@25.2.0 \
  && pnpm exec tsc -p /build/tsconfig.build.json

FROM node:22 AS runner

WORKDIR /app

ARG APP_UID=1000
ARG APP_GID=1000

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/data/dev.db"

RUN npm install -g pnpm@10.0.0

COPY --chown=${APP_UID}:${APP_GID} public ./public
COPY --chown=${APP_UID}:${APP_GID} emails ./emails
COPY --chown=${APP_UID}:${APP_GID} lib ./lib
COPY --chown=${APP_UID}:${APP_GID} scripts ./scripts
COPY --chown=${APP_UID}:${APP_GID} .next/standalone ./
COPY --chown=${APP_UID}:${APP_GID} .next/static ./.next/static
COPY --chown=${APP_UID}:${APP_GID} prisma ./prisma
COPY --chown=${APP_UID}:${APP_GID} prisma.config.ts ./prisma.config.ts
COPY --chown=${APP_UID}:${APP_GID} --from=scripts-builder /build/scripts-dist/run-db-migrations.js ./scripts-dist/run-db-migrations.js
COPY --chown=${APP_UID}:${APP_GID} docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh

USER ${APP_UID}:${APP_GID}

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["/app/docker-entrypoint.sh"]
