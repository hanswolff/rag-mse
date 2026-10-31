# 03 — Kalender-Oberfläche für Admins

Status: done

**What to build:** Benutzer-Auswahl im Abwesenheits-Formular (nur Admins), Bearbeiten/Löschen
je Eintrag in der Tagesliste fremder Abwesenheiten (nur Admins), Anzeige „Eingetragen von …“.
Siehe PRD Punkte 5 und 10.

**Blocked by:** 02

- [x] Quelle der Benutzerliste: aktivierte Benutzer, nach Name sortiert (vorhandene Admin-API wiederverwenden, wenn passend)
- [x] Formular: Auswahl vorbelegt mit sich selbst bzw. Eigentümer; sendet `userId`
- [x] Tagesliste: Aktionen nur für Admins, nicht für Prüfer
- [x] Details/Tagesliste: „Eingetragen von <Name>“ / „Eingetragen von einem Administrator“
- [x] Unit-Tests (Formular-Hook, Dialog, Kalender-Seite)

**Umsetzung:** Benutzerliste über schlanken Endpunkt `GET /api/abwesenheiten/benutzer`
(nur `canManageAllAbsences`, aktivierte Benutzer, nur `id` + `name`, deutsch nach Name sortiert,
`no-store`), lazy beim Öffnen des Formulars geladen. `GET /api/admin/users` passt nicht: auch für
Prüfer lesbar und liefert E-Mail, Adresse usw.; serverseitiges Mitgeben würde die öffentliche
Kalenderseite dynamisch machen. Integrationstest `__tests__/integration/21-abwesenheiten-benutzerliste.test.ts`.
