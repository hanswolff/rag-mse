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
- Kontakt (email form to admins)
- Rechtliches: Impressum + Datenschutzerklaerung (and cookie banner only if cookies are used)

## Roles and permissions

- Admins:
  - Create, edit, delete events
  - Create member accounts
  - Can submit a Teilnahmeanmeldung (Ja/Nein/Vielleicht)
- Members:
  - Manage own data (name, address, phone, email)
  - Submit a Teilnahmeanmeldung (Ja/Nein/Vielleicht)
- No public registration; accounts are admin-provisioned.

## Termine und Teilnahmeanmeldung

(Begriffe: siehe `CONTEXT.md`. „Termin" = Prisma `Event`; „Teilnahmeanmeldung" = Ja/Nein/Vielleicht = Prisma `Vote`/`GuestRegistration`. Nicht mit „Umfrage" (`Poll`) verwechseln — „Stimme/abstimmen" gehören ausschließlich zur Umfrage.)

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

## Agent skills

### Issue tracker

Issues and PRDs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, using the default strings, recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
