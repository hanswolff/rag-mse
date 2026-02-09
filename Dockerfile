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

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/data/dev.db"

RUN npm install -g pnpm@10.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --chown=nextjs:nodejs public ./public
COPY --chown=nextjs:nodejs emails ./emails
COPY --chown=nextjs:nodejs lib ./lib
COPY --chown=nextjs:nodejs scripts ./scripts
COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./.next/static
COPY --chown=nextjs:nodejs prisma ./prisma
COPY --chown=nextjs:nodejs prisma.config.ts ./prisma.config.ts
COPY --chown=nextjs:nodejs --from=scripts-builder /build/scripts-dist/run-db-migrations.js ./scripts-dist/run-db-migrations.js
COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["/app/docker-entrypoint.sh"]
