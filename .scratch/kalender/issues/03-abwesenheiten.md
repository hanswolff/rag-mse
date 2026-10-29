# 03 — Abwesenheiten erfassen, schützen und automatisch löschen

Status: done

**What to build:** Modell `Absence` und API, mit der eingeloggte Benutzer eigene
[[Abwesenheit]]en anlegen, ändern und löschen. Löschfrist 30 Tage nach Ende im
Maintenance-Worker. Datenschutzerklärung ergänzt. Siehe PRD „Abwesenheit“.
(Die Oberfläche dafür entsteht im Kalender, Issue 05.)

**Blocked by:** 02 (gemeinsame Zeitmodell-Validierung).

- [x] Schema + Migration `Absence` (`userId` Cascade, `reason` ≤ 200); `MIGRATIONS.md`.
- [x] API `/api/abwesenheiten` (GET eigene, POST) und `/api/abwesenheiten/[id]` (PUT, DELETE)
      — nur eigene, fremde ⇒ 404, auch für Admins; CSRF; anonym 401.
- [x] Maintenance-Worker: `ABSENCE_RETENTION_DAYS = 30`, löscht Abwesenheiten mit
      `endDate` älter als 30 Tage, Anzahl im Log.
- [x] Benutzer löschen entfernt seine Abwesenheiten (Cascade, Integrationstest).
- [x] Datenschutzerklärung: Abschnitt Abwesenheiten (Zweck: Terminplanung; Empfänger:
      Administratoren und Prüfer; Speicherdauer 30 Tage nach Ende) + „Speicherdauer“ ergänzt;
      Test angepasst.
- [x] Integrationstests: eigene vs. fremde, Löschfrist, Kaskade.
