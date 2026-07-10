FROM node:22 AS runner

LABEL org.opencontainers.image.source="https://github.com/your-org/beta-rag-mse"
LABEL org.opencontainers.image.description="RAG Schießsport MSE Website"

WORKDIR /app

ARG APP_UID=1000
ARG APP_GID=1000

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/data/dev.db"

COPY --chown=${APP_UID}:${APP_GID} .next/standalone ./
COPY --chown=${APP_UID}:${APP_GID} .next/static ./.next/static
COPY --chown=${APP_UID}:${APP_GID} public ./public
COPY --chown=${APP_UID}:${APP_GID} emails ./emails
COPY --chown=${APP_UID}:${APP_GID} prisma ./prisma
COPY --chown=${APP_UID}:${APP_GID} prisma.config.ts ./prisma.config.ts
COPY --chown=${APP_UID}:${APP_GID} scripts-dist ./scripts-dist
COPY --chown=${APP_UID}:${APP_GID} entrypoint.sh ./entrypoint.sh

RUN chmod +x /app/entrypoint.sh

USER ${APP_UID}:${APP_GID}

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["/app/entrypoint.sh"]
