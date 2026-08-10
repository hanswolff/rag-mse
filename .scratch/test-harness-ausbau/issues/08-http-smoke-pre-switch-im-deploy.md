# 08 — HTTP-Smoke gegen den neuen Container vor dem Umschalten

Status: done

**What to build:** `deploy.sh` prüft den frisch gebauten Container, **bevor** der
Prod-Container ersetzt wird. Heute fällt ein „App bootet, aber Route 500t“ erst nach
dem Umschalten auf (Healthcheck/Rollback) — Produktion ist dann bereits kurz betroffen.

Ablauf im Deploy (nach `podman-compose build app`, vor dem Backup/Umschalten):

1. Den neuen Image-Stand als Wegwerf-Container starten: eigener Name, Testport
   (nicht 3000), **eigene leere Wegwerf-Datenbank** in einem Temp-Verzeichnis —
   niemals die Prod-DB; Migrationen laufen darin (prüft nebenbei „Migrationen auf
   leerer DB“).
2. Ein Node-Skript (`scripts/`, Muster: `check-csp-smoke.js`) prüft per fetch:
   - Startseite, `/termine`, `/login`, `/ausschreibungen`, `/news` → HTTP 200 und
     erwartbarer Inhalt (kein Error-Marker),
   - öffentliche APIs (`/api/events`, `/api/health`) → 200 mit plausiblem JSON,
   - unbekannte Route → 404,
   - Security-Header vorhanden,
   - geschützte API ohne Session → 401/403 (nicht 500).
3. Wegwerf-Container und Temp-DB werden **immer** aufgeräumt (auch im Fehlerfall).
4. Nur bei Grün geht das Deploy weiter (Backup → Umschalten → Healthcheck →
   Selftest aus Issue 01).

**Blocked by:** None — unabhängig von der Integrationsschicht. (Issue 01 sollte
zuerst gemergt sein, damit die Gate-Reihenfolge im Skript einmal festgelegt wird.)

- [x] Ein absichtlich kaputter Build (z. B. Route wirft beim Rendern) lässt das
      Deploy **vor** dem Umschalten scheitern; der laufende Prod-Container bleibt
      unberührt.
- [x] Die Wegwerf-Instanz berührt weder Prod-DB noch Prod-Port noch den
      Prod-Containernamen; Aufräumen ist per `trap` gesichert.
- [x] Das Smoke-Skript hat Timeouts und eine klare Fehlerausgabe (welche URL, was
      erwartet, was erhalten).
- [x] Ein Test sichert die Prüfliste des Smoke-Skripts (Unit-Test des Skripts,
      Muster: `__tests__/check-script-deps.test.ts`).
