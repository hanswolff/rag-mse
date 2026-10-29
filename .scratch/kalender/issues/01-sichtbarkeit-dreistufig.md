# 01 — Sichtbarkeitsstufe für Termine

Status: done

**What to build:** Der [[Termin]] erhält die [[Sichtbarkeitsstufe]] *Öffentlich / Nur für
Mitglieder / Verborgen*, die `Event.visible` vollständig ersetzt. Dazu wird das vorhandene
Enum `AusschreibungVisibility` zum gemeinsamen Enum `Visibility` (PUBLIC/MEMBER/HIDDEN)
verallgemeinert. Siehe PRD, Abschnitt „Sichtbarkeitsstufe (Termin)“.

**Blocked by:** –

- [x] `AusschreibungVisibility` → `Visibility` umbenannt (Schema, Code, Tests), Ausschreibungen
      verhalten sich unverändert; Beschriftungen/Farben gemeinsam genutzt.
- [x] Schema + Migration: `visibility` mit Default `PUBLIC`, Backfill `visible=0 → HIDDEN`,
      Spalte `visible` entfernt; `run-db-migrations.test.ts` grün; `MIGRATIONS.md`-Eintrag.
- [x] `buildVisibilityFilter`: anonym nur PUBLIC; eingeloggt PUBLIC+MEMBER (+ eigene
      verborgene); Admin/Prüfer alles.
- [x] Alle `visible`-Stellen umgestellt (öffentliche API, Detail-API, Vote-Route, RSVP-Token,
      Erinnerungs-Worker inkl. Sofort-Erinnerung, Sitemap, Metadaten, Startseite, Liste,
      Vergangenheit, Admin-Liste, Formular, Validierung, Fixtures, Factories).
- [x] Erinnerungen und Teilnahmeanmeldung funktionieren für PUBLIC und MEMBER, nicht für HIDDEN.
- [x] Anonym auf MEMBER-Termin: Detail-API 401 ohne Daten; Detailseite leitet auf
      `/login?returnUrl=/termine/<id>` um; Metadaten generisch + noindex.
- [x] Formular: Auswahlfeld „Sichtbarkeitsstufe“ statt Checkbox; Admin-Liste/Terminkarte zeigen
      Kennzeichen „Nur für Mitglieder“ bzw. „Verborgen“; „Veröffentlichen“ setzt PUBLIC.
- [x] Beschriftung/Farbe der Sichtbarkeitsstufe zentral an einer Stelle.
- [x] Integrationstest: Sichtbarkeitsstufe je Rolle (anonym/Mitglied/Prüfer/Admin) für Liste,
      Detail und Teilnahmeanmeldung; Backfill-Test der Migration.
