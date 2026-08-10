# Deployment-Selbsttest (`/api/selftest`)

Tiefer, **zustandsfreier** Selbsttest, der nach einem Deploy prüft, ob alle wichtigen
Teilsysteme funktionieren und kritische Daten vorhanden sind. Ergänzt den flachen
Liveness-Check `/api/health` (nur `SELECT 1`), ersetzt ihn aber nicht.

## Aufruf

```bash
curl -i -H "Authorization: Bearer $SELFTEST_TOKEN" https://<host>/api/selftest
```

### Automatischer Aufruf im Deploy

`deploy.sh` ruft den Selbsttest nach erfolgreichem Healthcheck als Post-Deploy-Gate
auf (`http://127.0.0.1:3000/api/selftest`):

- `error` (HTTP 503): Deploy schlägt fehl, Rollback im Modus `image-only` — die App
  war bereits healthy, die Datenbank bleibt unangetastet (ADR 0008). Die `errors[]`
  stehen im Deploy-Log.
- `warn` (HTTP 200): Deploy gilt als erfolgreich; die Warnungen samt `component`
  werden im Deploy-Log ausgegeben.
- `SELFTEST_TOKEN` nicht gesetzt (Host oder Container): deutliche Warnung, aber kein
  Fehlschlag und kein Rollback — `self-test not configured` ist eine
  Konfigurationslücke, kein App-Defekt.

## Antwort

JSON-Report mit Gesamtstatus und einer Liste isolierter Einzelprüfungen:

```jsonc
{
  "status": "ok",            // "ok" | "warn" | "error"
  "timestamp": "2026-06-20T03:30:00.000Z",
  "version": "1.5.3",
  "durationMs": 142,
  "checks": [
    { "name": "database.connectivity", "component": "Datenbank", "status": "ok", "durationMs": 3 }
    // ...
  ],
  "warnings": [{ "component": "Speicherplatz", "message": "Wenig Speicherplatz: 320 MB frei" }],
  "errors":   []
}
```

| Status   | HTTP | Bedeutung |
| -------- | ---- | --------- |
| `ok`     | 200  | Alle Prüfungen bestanden (oder bewusst übersprungen). |
| `warn`   | 200  | Nur nicht-kritische Hinweise. Deploy gilt als gesund, sollte aber beobachtet werden. |
| `error`  | 503  | Mindestens ein Teilsystem ist defekt. |
| –        | 401  | Token fehlt oder ist falsch. |
| –        | 503  | `self-test not configured` – `SELFTEST_TOKEN` ist nicht gesetzt. |

Jede Prüfung trägt ein `component` ("der defekte Teil der Anwendung"); `warnings[]` und
`errors[]` fassen Probleme samt `component` für schnelles Alerting zusammen.

## Geprüfte Teilsysteme

| `name`                | `component`            | Prüfung |
| --------------------- | ---------------------- | ------- |
| `database.connectivity` | Datenbank            | `SELECT 1` |
| `database.migrations`   | Datenbank-Schema     | Alle `prisma/migrations/*` sind in `_AppMigration` eingetragen |
| `data.critical`         | Stammdaten           | ≥1 `SITE_ADMINISTRATOR` (Fehler, wenn keiner); Warnung bei leeren Schießständen/Mitgliedern |
| `data.email_queue`      | E-Mail-Warteschlange | Warnung bei dauerhaft fehlgeschlagenen / festhängenden Outbox-E-Mails |
| `storage.documents`     | Dokumentenspeicher   | Verzeichnis les-/beschreibbar; Stichprobe der DB-Dokumente existiert auf der Platte |
| `email.smtp`            | E-Mail/SMTP          | Live-`verify()` (Verbindung + Auth), **kein** Mailversand |
| `system.workers`        | Hintergrund-Worker   | E-Mail-Outbox- und Termin-Erinnerungs-Worker laufen |
| `system.config`         | Konfiguration        | `validateProductionConfig()` (Fehler → error, Warnungen → warn) |
| `system.disk`           | Speicherplatz        | Freier Speicher im Dokumentenverzeichnis via `statfs` |

## Wichtige Design-Entscheidungen

1. **Zustandsfrei und ohne Nebenwirkungen.** Es werden ausschließlich lesende Operationen
   ausgeführt: `SELECT`/`count`-Abfragen, `fs.access`/`stat`/`statfs` und SMTP-`verify()`.
   Es werden **keine** Daten geändert, **keine** Dateien geschrieben und **keine** E-Mail
   versendet. So ist der Endpunkt gefahrlos beliebig oft (auch automatisiert) aufrufbar.

2. **Token-Schutz, fail-safe.** Der Endpunkt legt interne Zustände offen und ist daher über
   `SELFTEST_TOKEN` (Bearer-Header, konstante Vergleichszeit via `crypto.timingSafeEqual`)
   geschützt. Ist das Token **nicht** gesetzt, wird der Test **nicht** ausgeführt (HTTP 503).
   Der Endpunkt ist damit niemals versehentlich offen. `/api/health` bleibt bewusst öffentlich
   und flach für den HAProxy-Liveness-Check.

3. **Warnungen ergeben HTTP 200, Fehler HTTP 503.** Damit kann ein einfacher Uptime-Monitor
   nur auf den Statuscode achten: degradierte (aber funktionierende) Zustände lösen keinen
   Alarm aus, echte Defekte schon. Details stehen immer im JSON-Body.

4. **Isolierte Prüfungen mit Timeout.** Jede Prüfung läuft in eigener `try/catch`-Kapselung
   mit eigenem Zeitlimit (`lib/selftest/runner.ts`). Eine hängende oder werfende Prüfung wird
   zu einem `error`-Ergebnis – sie kann den Report oder andere Prüfungen nicht zum Absturz
   bringen. Prüfungen laufen parallel (`Promise.all`).

5. **Stillgelegter Worker = Fehler (nicht Warnung).** Worker werden beim Boot synchron
   gestartet, bevor Requests bedient werden; ein nicht laufender Worker bedeutet daher ein
   real kaputtes Feature (kein Mailversand / keine Erinnerungen), keinen Startup-Race. Unter
   dem Test-Runner (`NODE_ENV=test`) werden Worker absichtlich nicht gestartet – dort wird die
   Prüfung als `skipped` gemeldet, um Fehlalarme zu vermeiden.

6. **SMTP: Live-`verify()` statt nur Config-Prüfung.** Beweist, dass Host, Port und
   Zugangsdaten tatsächlich funktionieren, ohne eine Mail zu senden. Im Dev-Modus
   (`EMAIL_DEV_MODE=true`) wird **vor** dem Laden der SMTP-Konfiguration übersprungen, da dort
   bewusst keine SMTP-Daten gesetzt sein müssen. Optional komplett abschaltbar über
   `SELFTEST_CHECK_SMTP=false`.

7. **Wiederverwendung statt Duplikat.** Der SMTP-Transport wird über die gemeinsame Fabrik
   `createSmtpTransport()` in `lib/email/outbox-worker.ts` erzeugt – dieselbe, die der
   Versand nutzt. Damit kann die Config zwischen Versand und Prüfung nicht auseinanderlaufen.
   Worker-Laufstatus wird über `isEmailOutboxWorkerRunning()` /
   `isEventReminderWorkerRunning()` gekapselt statt über direkte Globals.

## Konfiguration

| Variable             | Pflicht | Bedeutung |
| -------------------- | ------- | --------- |
| `SELFTEST_TOKEN`     | ja\*    | Schaltet den Endpunkt frei (Bearer-Token). Ohne ihn → 503. Langer Zufallswert, z. B. `openssl rand -hex 32`. |
| `SELFTEST_CHECK_SMTP`| nein    | `false` deaktiviert die SMTP-Live-Prüfung (Standard: aktiviert). |

\* Ohne Token ist der Endpunkt funktionslos (gibt 503 zurück); in Produktion sollte er gesetzt sein.

## Code

- Endpunkt: `app/api/selftest/route.ts`
- Runner + Typen: `lib/selftest/runner.ts`, `lib/selftest/types.ts`
- Prüfungen: `lib/selftest/checks/*` (registriert in `lib/selftest/checks/index.ts`)
- Tests: `__tests__/selftest-{api,runner,checks}.test.ts`
