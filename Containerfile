FROM node:22-slim AS runner

LABEL org.opencontainers.image.source="https://github.com/hanswolff/beta-rag-mse"
LABEL org.opencontainers.image.description="RAG Schießsport MSE Website"

WORKDIR /app

# node:22-slim bringt kein wget mit; der Healthcheck in compose.yaml ruft es auf.
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget \
  && rm -rf /var/lib/apt/lists/*

ARG APP_UID=1000
ARG APP_GID=1000

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/data/prod.db"
# Datumslogik (Termin-Grenzen, Erinnerungen) rechnet mit lokaler Zeit;
# der Container muss deshalb in deutscher Zeitzone laufen, nicht UTC.
ENV TZ="Europe/Berlin"

COPY --chown=${APP_UID}:${APP_GID} .next/standalone ./
COPY --chown=${APP_UID}:${APP_GID} .next/static ./.next/static
COPY --chown=${APP_UID}:${APP_GID} public ./public
COPY --chown=${APP_UID}:${APP_GID} emails ./emails
# prisma/ enthält auch die Bootstrap-Baseline (prisma/baseline.sql),
# ohne die der Erststart mit leerer Datenbank crasht (ENOENT im Migrations-Runner)
COPY --chown=${APP_UID}:${APP_GID} prisma ./prisma
COPY --chown=${APP_UID}:${APP_GID} scripts-dist ./scripts-dist
COPY --chown=${APP_UID}:${APP_GID} entrypoint.sh ./entrypoint.sh

RUN chmod +x /app/entrypoint.sh

USER ${APP_UID}:${APP_GID}

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["/app/entrypoint.sh"]
