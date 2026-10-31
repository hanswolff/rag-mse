# 05 — Release 1.8.1

Status: done

**What to build:** Version 1.8.1 mit den Befunden aus dem Gesamt-Review (01–04).
Keine Release-News (PRD: nicht im Umfang).

**Blocked by:** 01–04. (Ausgangsversion ist 1.8.0.)

- [x] Befunde aus Gesamt-Review: Eintragender beim Umhängen selbst eingetragener
      Abwesenheiten (PRD Punkt 5), Sichtbarkeitshinweis im Formular, Datenschutz-Wortlaut,
      `README.md`, Rollback-Hinweis in `MIGRATIONS.md`, Aufräumarbeiten.
- [x] `package.json` auf 1.8.1 (`lib/version-info.ts` wird beim Build per `scripts/generate-version.ts` erzeugt);
      Beispiel in `docs/SELFTEST.md`.
- [x] `pnpm lint`, Typecheck und `pnpm test` grün.
