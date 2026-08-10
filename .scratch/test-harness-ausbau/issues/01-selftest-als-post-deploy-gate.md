# 01 — Selftest als Post-Deploy-Gate in deploy.sh

Status: done

**What to build:** `deploy.sh` ruft nach dem erfolgreichen Healthcheck (und vor bzw.
neben dem bestehenden CSP-Smoke-Check) `GET /api/selftest` mit dem `SELFTEST_TOKEN`
aus der `.env` auf und wertet das Ergebnis als Gate:

- Status `error` (HTTP 503): Deploy schlägt fehl, Rollback im Modus `image-only` —
  die App war bereits healthy, die Datenbank darf nicht mehr angefasst werden
  (ADR 0008).
- Status `warn` (HTTP 200): Deploy gilt als erfolgreich; die Warnungen (`warnings[]`
  mit `component` und `message`) werden im Deploy-Log ausgegeben.
- Status `ok`: Deploy erfolgreich.
- `SELFTEST_TOKEN` nicht gesetzt: deutliche Warnung, aber kein Fehlschlag — der
  Selftest ist dann `self-test not configured` (503) und darf das Deploy nicht
  fälschlich zurückrollen.

**Blocked by:** None — can start immediately.

- [x] `deploy.sh` ruft `/api/selftest` auf `http://127.0.0.1:3000` mit
      `Authorization: Bearer $SELFTEST_TOKEN` auf, nachdem der Container healthy ist.
- [x] Bei HTTP 503 mit gesetztem Token wird `rollback_deployment "image-only"`
      ausgeführt und das Skript endet mit Fehlerstatus; die `errors[]` aus der
      Antwort stehen im Log.
- [x] Bei `warn` erscheinen die Warnungen samt `component` im Log; das Deploy läuft
      weiter und endet erfolgreich.
- [x] Fehlender `SELFTEST_TOKEN` erzeugt eine Warnung, aber keinen Rollback.
- [x] Ein Test (Muster: `__tests__/container-hardening.test.ts` u. Ä., die
      `deploy.sh` textuell prüfen) stellt sicher, dass der Selftest-Aufruf und die
      Rollback-Verzweigung im Skript vorhanden bleiben.
- [x] `docs/SELFTEST.md` erwähnt den automatischen Aufruf im Deploy.
