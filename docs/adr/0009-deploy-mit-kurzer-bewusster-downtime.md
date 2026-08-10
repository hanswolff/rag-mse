# Deployment mit kurzer bewusster Downtime statt Blue-Green

`deploy.sh` stoppt den laufenden Container und startet den neuen an seiner Stelle
(`--force-recreate`). Zwischen Stopp und erstem erfolgreichen Healthcheck ist die Seite
nicht erreichbar — die Zeit für Migration und Next-Boot, üblicherweise einige Sekunden
bis wenige Minuten. Das ist eine bewusste Entscheidung, kein Versehen.

## Considered Options

- **Gewählt: kurze Downtime in Kauf nehmen.** Ein Vereinsauftritt mit überschaubarem
  Publikum verträgt ein Wartungsfenster von Sekunden; Deployments lassen sich zudem in
  Randzeiten legen. Der Ablauf bleibt dadurch einfach genug, um im Fehlerfall
  verstanden und von Hand nachvollzogen zu werden.
- **Verworfen (vorerst): Blue-Green mit zweitem Container und HAProxy-Umschaltung.**
  Es beseitigt die Downtime, verlangt aber ein echtes Redesign von `deploy.sh` und
  `haproxy.cfg` — und vor allem eine Antwort auf die Frage, was zwei gleichzeitig
  laufende Instanzen mit dem gemeinsamen Zustand machen (siehe Consequences). Ohne
  Testumgebung träfe jeder Fehler im Umschaltpfad direkt die Produktion.

## Consequences

- Jedes Deployment erzeugt ein kurzes Wartungsfenster. HAProxy nimmt das Backend
  während dieser Zeit aus dem Verkehr; Besucher sehen die Fehlerseite des Proxys.
- Der Ablauf bleibt sequenziell und dadurch nachvollziehbar: Backup, Stopp, Start,
  Healthcheck, bei Fehlschlag Rollback (siehe [ADR 0008](./0008-rollback-nur-image-nach-erfolgreichem-healthcheck.md)).
- **Blue-Green ist kein reiner Deploy-Umbau.** Zwei gleichzeitig laufende Instanzen
  brechen mindestens drei bestehende Annahmen: das In-Process-Rate-Limiting
  ([ADR 0006](./0006-in-process-rate-limiting-statt-redis.md)) hätte getrennte Zähler,
  der Outbox-Worker ([ADR 0005](./0005-outbox-pattern-fuer-e-mail-versand.md)) liefe
  doppelt, und zwei Prozesse schrieben gleichzeitig auf dieselbe SQLite-Datei. Wer das
  Thema aufgreift, muss diese drei Punkte zuerst lösen.
- Der offene Punkt bleibt im Ticket
  `.scratch/review-2026-07-gesamt/issues/05-infrastruktur-folgearbeiten.md` vermerkt.
