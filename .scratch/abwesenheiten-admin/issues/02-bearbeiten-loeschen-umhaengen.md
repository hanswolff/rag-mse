# 02 — Fremde Abwesenheiten bearbeiten, löschen, umhängen (API)

Status: done

**What to build:** PUT/DELETE `/api/abwesenheiten/[id]` für Admins auf fremde Einträge;
PUT mit optionalem `userId` hängt um. Siehe PRD Punkte 3, 4, 6, 8, 9.

**Blocked by:** 01

- [x] Admin bearbeitet/löscht fremde Abwesenheit; Prüfer/Mitglied fremd ⇒ 404 wie bisher
- [x] PUT mit `userId` hängt um (nur Admin; Mitglied mit fremder `userId` ⇒ 403); `createdById` bleibt
- [x] Limit beim neuen Eigentümer; nicht aktivierter Ziel-Benutzer ⇒ 400
- [x] Eigentümer darf vom Admin eingetragene Abwesenheit ändern/löschen
- [x] `logInfo` mit `actorId` und `userId`
- [x] Integrationstests
