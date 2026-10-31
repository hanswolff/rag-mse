# 01 — „Eingetragen von“ und Anlegen für andere Benutzer (API)

Status: done

**What to build:** Schema-Feld `Absence.createdById` + Migration (Backfill), Berechtigung
`Permissions.canManageAllAbsences`, POST `/api/abwesenheiten` mit optionalem `userId`.
Kalender-API liefert pro Abwesenheit die für die Anzeige nötigen Felder (`userId`,
Herkunftsangabe „eingetragen von“). Siehe PRD Punkte 2, 5, 8, 9.

**Blocked by:** –

- [x] Migration (eigener Runner, `MIGRATIONS.md`), Backfill `createdById = userId`, `onDelete: SetNull`
- [x] `canManageAllAbsences` (ADMIN, SITE_ADMINISTRATOR) + Unit-Test
- [x] POST: Admin legt für aktivierten Benutzer an; Prüfer/Mitglied mit fremder `userId` ⇒ 403; nicht aktivierter/unbekannter Benutzer ⇒ 400; eigener Eintrag setzt `createdById` = sich selbst
- [x] Limit zählt beim Eigentümer; Meldung nennt Namen, wenn Admin für anderen handelt
- [x] Kalender-Daten: `userId` (nur für Admin/Prüfer nötig) und „eingetragen von“-Angabe (Name / anonym / keine)
- [x] Integrationstests in `__tests__/integration/15-abwesenheiten.test.ts` (bzw. Kalender-API-Test)
