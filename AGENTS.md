# AGENTS.md

## Project overview

- Purpose: website for RAG Schießsport MSE with member login, admin-managed events, attendance polls, news, and contact.
- Tech: Next.js app in rootless Podman (podman-compose), SQLite database with persistent volume mount.
- Language: German-only UI.
- Branding: align with RAG-Schießsport look.
- Task tracking: see TODO.md for implementation checklist, mark tasks as done when a task is finished
- Terminology: `CONTEXT.md` is the authoritative glossary (Ubiquitous Language, German). Use its terms; the DB/code stays English (mapping noted per term). See also `docs/agents/domain.md`.
- Code: use best practices and clean coding standards, avoid many comments in code (make code concise enough so no comments are needed)
- Styling: prefer global styling (theme tokens, shared utility classes) over per-component/local styling whenever practical
- CI/CD: `deploy.sh` is the deployment pipeline. Do not use git hooks or GitHub Actions.

## Core pages

- Startseite
- Termine (list + detail)
- Login
- Profil (member profile management)
- Adminbereich (user + event management)
- News
- Umfragen (member voting on polls: `/umfragen`, short link `/u/<code>`; admin: `/admin/umfragen`)
- Ausschreibungen (public PDF announcements: `/ausschreibungen`; admin: `/admin/ausschreibungen`)
- Mitglieder-Dokumente (read access for members: `/mitglieder-dokumente`; admin: `/admin/mitglied-dokumente`)
- Standorte (admin-only shooting range management: `/admin/standorte`)
- Benachrichtigungen (member reminder settings: `/benachrichtigungen`; admin history: `/admin/benachrichtigungen`)
- Kontakt (email form to admins)
- Rechtliches: Impressum + Datenschutzerklaerung (and cookie banner only if cookies are used)

## Roles and permissions

Four roles, consistent with `CONTEXT.md` and `lib/permissions.ts`:

- `SITE_ADMINISTRATOR` (system-internal, not assignable via UI):
  - All ADMIN rights plus impersonation and editing of SITE_ADMINISTRATOR accounts
- `ADMIN`:
  - Full admin-area write access: users, events, news, documents, polls (Umfragen), Ausschreibungen, Standorte, invitations
  - Can submit a Teilnahmeanmeldung (Ja/Nein/Vielleicht) and vote in Umfragen
- `AUDITOR` (read-only):
  - Read access to the admin area (except outgoing emails and admin notifications), no write operations
  - Member-level functions (profile, Teilnahmeanmeldung, Umfrage vote) available
- `MEMBER`:
  - Manage own data (name, address, phone, email)
  - Submit a Teilnahmeanmeldung (Ja/Nein/Vielleicht), vote in Umfragen, read Mitglieder-Dokumente
- No public registration; accounts are admin-provisioned (Einladung).

## Termine und Teilnahmeanmeldung

(Begriffe: siehe `CONTEXT.md`. „Termin“ = Prisma `Event`; „Teilnahmeanmeldung“ = Ja/Nein/Vielleicht = Prisma `Vote`/`GuestRegistration`. Nicht mit „Umfrage“ (`Poll`) verwechseln — „Stimme/abstimmen“ gehören ausschließlich zur Umfrage.)

- Only admins create Termine.
- Termine-Seiten (/termine) und öffentliche Events-API (/api/events) sind öffentlich zugänglich.
- Alle Termine (Liste + Detail) müssen ohne Login zugänglich sein.
- Teilnahmeanmeldungen und deren Ergebnisse dürfen nur für eingeloggte Benutzer sichtbar sein.
- Eingeloggte Mitglieder müssen ihre eigene Teilnahmeanmeldung sehen und zurückziehen können.
- Event fields: date, time from/to, location, short description.
- Teilnahmeanmeldung je Termin: Ja/Nein/Vielleicht, genau eine Anmeldung pro Person (Admins eingeschlossen).
- No comments on Termine.
- Map only on Termin detail page. Prefer OpenStreetMap (no Google Maps API key).

## Authentication

- Email + password login.
- Simple password policy; no 2FA.
- Login requires an activated account (`activatedAt` set via Einladungseinlösung); SITE_ADMINISTRATOR accounts self-activate on first successful login.

## Data and hosting

- SQLite database.
- DB file stored in a host-mounted bind volume (./data) for easy backups; rootless Podman uses `userns_mode: keep-id` to keep it writable.
- Deployed on VPS behind reverse proxy (HAProxy expected).
- Local dev via podman-compose.
- Die vorhandene `compose.yaml` ist produktiv im Einsatz und muss als produktionsrelevant behandelt werden.

## Contact form

- Sends email to administrators.
- Define admin recipient list in config/env.

## Open decisions to confirm later

- Exact legal text for Impressum/Datenschutzerklaerung (content from organization).
- Final visual assets (official logo file and brand color palette).
- Email delivery method (SMTP provider credentials).

## Confirmed requirements

- Bei der Einladungseinlösung (`/einladung/[token]`) müssen Name, Adresse und Telefon mit denselben Serverregeln validiert werden wie in den übrigen Benutzer-APIs.
- Transport-Security (HSTS / `Strict-Transport-Security`) wird bewusst am Reverse-Proxy gesetzt (`haproxy.cfg.example`, abgedeckt durch `__tests__/haproxy-config.test.ts`) und nicht in `next.config.mjs`. Ein HSTS-Header auf App-Ebene ist daher nicht erforderlich.
- The container runs with `TZ=Europe/Berlin` (set in `Containerfile` and `compose.yaml`) because event date logic uses local time; do not remove or change this.
- `deploy.sh` runs lint, typecheck, and tests as quality gates before building — do not remove these gates. The test gate deliberately runs **without** coverage (`pnpm test`): measuring coverage over the whole codebase took ~12 min versus ~1.5 min for the same tests and dominated every deploy. Coverage is therefore checked separately via `pnpm run test:coverage`, not on the deploy path — run it when you change what the thresholds cover. The `coverageThreshold` values in `jest.config.ts` still apply to that run; do not lower them below the current state. Coverage is measured over the whole codebase via `collectCoverageFrom` (`app/`, `lib/`, `components/`), not only over files a test happens to import — keep that list intact, otherwise untested modules become invisible.
- `deploy.sh` aborts up front if both `data/prod.db` and a legacy `data/dev.db` exist. The container entrypoint refuses to start in that state, and without the preflight it only surfaces after the full gate run and the container swap — costing a whole deploy cycle plus a rollback. A forgotten, usually empty `dev.db` from a stray Prisma call is enough to trigger it.
- Alle Dateien unter `public/dokumente/` sind bewusst öffentlich abrufbar — einschließlich `Fragenkatalog_Sachkundepruefung_mit_Antworten.pdf`. Der Fragenkatalog mit Antworten dient der Prüfungsvorbereitung und ist kein Verschlusssache-Dokument; er muss **nicht** in den Mitgliederbereich verschoben werden (entschieden 30.07.2026).

## Test layers

Two Jest projects with deliberately different rules (see ADR 0010):

- **unit** (`__tests__/*.test.ts[x]`): jsdom, global mocks from `jest.setup.js`
  (`next/server`, `next-auth`), Prisma mocked per test. For logic and UI behavior.
- **integration** (`__tests__/integration/`): node environment, **no** global mocks.
  Each test file gets a fresh SQLite (all migrations applied via
  `scripts/run-db-migrations.ts`); route handlers from `app/api/**/route.ts` run
  against the real Prisma client. Mocks only at system boundaries (NextAuth session,
  SMTP transport, system time). Run with `pnpm test:integration`; part of `pnpm test`.

New business logic involving DB constraints, tokens, state machines, or date logic
gets its test in the integration layer; pure logic and UI stay in the unit layer.
All test scripts run with `TZ=Europe/Berlin` to match the container.

Additionally there is a small **E2E layer** (`e2e/`, Playwright, Chromium only):
`pnpm test:e2e` runs 5–8 core click paths against a self-started production build
(`next start` on port 3900) with a fresh throwaway SQLite in a temp directory.
It is local/manual only and deliberately **not** a deploy gate — `deploy.sh`,
`pnpm test`, and `pnpm lint` stay untouched by Playwright. Prerequisites (once):
`pnpm build` and `pnpm exec playwright install chromium` (browser binaries are
not installed by `pnpm install`). Jest ignores `e2e/` via `testPathIgnorePatterns`.

## Agent skills

### Issue tracker

Issues and PRDs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, using the default strings, recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
