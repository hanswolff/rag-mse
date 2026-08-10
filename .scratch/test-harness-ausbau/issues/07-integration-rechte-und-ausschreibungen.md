# 07 — Integrationstests: Rechteprüfung und Ausschreibungs-Datumsgrenze

Status: done

**What to build:** Integrationstests (Schicht aus Issue 03) für die Durchsetzung der
[[Rolle]]n über die echten Routen und für die Datumslogik der [[Ausschreibung]]:

- **Rechteprüfung:** Für jede administrative Routengruppe (Benutzer, Termine, News,
  Dokumente, Umfragen, Ausschreibungen, Standorte, Einladungen) wird mit echter
  Session je Rolle geprüft: `AUDITOR` kann **lesen, aber nie schreiben** (POST/
  PUT/PATCH/DELETE werden abgelehnt und hinterlassen **keine** Änderung in der
  echten DB); [[Postausgang]] und Benachrichtigungs-Übersicht sind für `AUDITOR`
  auch lesend gesperrt; `MEMBER` erreicht keine Admin-Routen; [[Impersonierung]]
  ist ausschließlich `SITE_ADMINISTRATOR` möglich.
- **Ausschreibung aktuell/historisch:** Die Grenze „aktuell **bis einschließlich**
  [[Ablaufdatum]], historisch **ab dem Tag danach**“ wird gegen die echte DB mit
  `TZ=Europe/Berlin` geprüft — insbesondere am Stichtag selbst und um Mitternacht
  (der Container läuft fest mit dieser Zeitzone, AGENTS.md). Öffentliche Liste
  zeigt nur aktuelle; Historie bleibt abrufbar; der Übergang geschieht rein
  rechnerisch ohne Statusfeld.

**Blocked by:** 03 — braucht die Integrations-Infrastruktur.

- [x] Schreibversuche als `AUDITOR` werden über die echten Routen abgelehnt und
      verändern die Datenbank nachweislich nicht (Vorher/Nachher-Vergleich).
- [x] Die Rollenmatrix (4 Rollen × Routengruppen) ist systematisch abgedeckt, nicht
      nur stichprobenhaft.
- [x] Ausschreibungs-Tests fixieren die Uhrzeit (gemockte Systemzeit bei echter DB)
      und prüfen den Stichtag und den Tag danach in `Europe/Berlin`.
