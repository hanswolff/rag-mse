# AGENTS.md

## Project overview

- Purpose: website for RAG Schießsport MSE with member login, admin-managed events, attendance polls, news, and contact.
- Tech: Next.js app in Docker (docker compose), SQLite database with persistent volume mount.
- Language: German-only UI.
- Branding: align with RAG-Schießsport look; use “Wir sind die Reserve” logo (from internet).
- Task tracking: see TODO.md for implementation checklist, mark tasks as done when a task is finished
- Code: use best practices and clean coding standards, avoid many comments in code (make code concise enough so no comments are needed)
- Styling: prefer global styling (theme tokens, shared utility classes) over per-component/local styling whenever practical
- CI/CD: do not use git hooks or GitHub workers

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
  - Can vote on attendance
- Members:
  - Manage own data (name, address, phone, email)
  - Vote on attendance (Ja/Nein/Vielleicht)
- No public registration; accounts are admin-provisioned.

## Events and voting

- Only admins create events.
- Termine-Seiten (/termine) und öffentliche Events-API (/api/events) sind öffentlich zugänglich.
- Alle Termine (Liste + Detail) müssen ohne Anmeldung zugänglich sein.
- Voting und Voting-Ergebnisse dürfen nur für eingeloggte Nutzer sichtbar sein.
- Eingeloggte Mitglieder müssen ihre eigene abgegebene Stimme sehen und diese zurückziehen können.
- Event fields: date, time from/to, location, short description.
- Attendance poll per event: Ja/Nein/Vielleicht, one vote per member (admins included).
- No comments on events.
- Map only on event detail page. Prefer OpenStreetMap (no Google Maps API key).

## Authentication

- Email + password login.
- Simple password policy; no 2FA.

## Data and hosting

- SQLite database.
- DB file stored in a docker compose volume mounted to a host directory for easy backups.
- Deployed on VPS behind reverse proxy (HAProxy expected).
- Local dev via docker compose.
- Die vorhandene `docker-compose.yml` ist produktiv im Einsatz und muss als produktionsrelevant behandelt werden.

## Contact form

- Sends email to administrators.
- Define admin recipient list in config/env.

## Open decisions to confirm later

- Exact legal text for Impressum/Datenschutzerklaerung (content from organization).
- Final visual assets (official logo file and brand color palette).
- Email delivery method (SMTP provider credentials).

## Confirmed requirements

- Bei der Einladungseinlösung (`/einladung/[token]`) müssen Name, Adresse und Telefon mit denselben Serverregeln validiert werden wie in den übrigen Benutzer-APIs.
