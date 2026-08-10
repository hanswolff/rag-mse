# Infrastruktur-Folgearbeiten (Deploy, Backups, Image, ADRs)

Status: ready-for-human

Punkte 3–8 sind umgesetzt. Offen sind nur noch Punkt 1 (Zero-Downtime-Deploy, bewusst
zurückgestellt — Ist-Zustand und die drei zuerst zu lösenden Annahmen in
`docs/adr/0009-deploy-mit-kurzer-bewusster-downtime.md`) und die Off-Host-Kopie aus
Punkt 2, für die Ziel und Zugangsdaten noch fehlen (`ops/BACKUP_OPTIONS.md`). Die
Monatsobergrenze aus Punkt 2 ist umgesetzt.

## What to build

Sammelticket aus dem Gesamt-Review 2026-07-30 (Befunde F12/F31, zurückgestellte Teile).
Mehrere Punkte sind Architektur-/Ops-Entscheidungen — vor Umsetzung abstimmen.

1. **Zero-Downtime-Deploy:** deploy.sh stoppt den alten Container vor dem Start des
   neuen (force-recreate) → harte Downtime je Deploy (Migration + Next-Boot). Option:
   zweiter Container + HAProxy-Umschaltung (blue-green). Echtes Redesign von deploy.sh
   und haproxy.cfg.
2. **Backups off-host:** Backups liegen auf demselben ZFS-Pool wie die Live-Daten;
   Monats-Backups unbegrenzt. Off-Host-Kopie (z.B. rclone/restic) + Obergrenze.
3. **Container-Image verschlanken:** `node:22` (~1 GB, Compiler) → `node:22-slim` +
   wget für den Healthcheck.
4. **Laufende Health-Überwachung:** podman-Healthcheck feuert rootless zwischen
   Deploys nicht; echte Liveness ist nur HAProxy `option httpchk`. Entscheiden, ob ein
   systemd-Timer `podman healthcheck run` + Restart-Aktion ergänzt wird.
5. **logrotate-Config:** `ops/logrotate/beta-rag-mse` hartkodiert UID 1000 und den
   Repo-Pfad; `APP_UID` respektieren.
6. **`prisma.config.ts`:** Seed-Kommando nutzt `ts-node`, Repo-Standard ist `tsx`.
7. **scripts-dist-Laufzeit-Abhängigkeiten:** Container-Skripte (seed.js u.a.) lösen
   `bcryptjs`/`zod`/... nur über `.next/standalone/node_modules` auf (Next-Tracing).
   Eine reine Skript-Abhängigkeit, die keine Server-Route importiert, würde im
   Container fehlen → Crash-Loop beim Start. Absicherung/Doku.
8. **ADR-Kandidaten** (Entscheidungen mit Überraschungswert, bisher undokumentiert):
   eigener SQL-Migrations-Runner statt `prisma migrate deploy`; Outbox-Pattern statt
   Direktversand; In-Process-Rate-Limiting statt Redis; Impersonations-Proof-Mechanik;
   Rollback-Politik „Image-only nach Healthy“ (seit Review-Fix in deploy.sh kommentiert).

Herkunft: Gesamt-Review 2026-07-30. Bereits behoben (nicht Teil dieses Tickets):
prod.db-Umbenennung inkl. Backup-Unit, create_admin.sql im Image, Quality-Gates in
deploy.sh, TZ=Europe/Berlin, DB-Restore nur bei fehlgeschlagener Migration,
Health-Wartezeit ~3 min, Log-Limit in compose.yaml, Backup-Unit als UID 1000.

## Comments

### 2026-08-04 — Umsetzung (abgestimmt)

Erledigt:

- **3. Container-Image verschlankt:** `node:22` → `node:22-slim` plus `wget` für den
  Healthcheck (ohne wget wäre der Container dauerhaft unhealthy). Image von ~1 GB auf
  384 MB. Im gebauten Image verifiziert; `__tests__/container-hardening.test.ts` deckt
  Basis-Image und wget-Installation ab.
- **4. Laufende Health-Überwachung:** `ops/systemd/beta-rag-healthcheck.{service,timer}`
  plus `ops/HEALTHCHECK.md`. Bewusst **Opt-in** und nicht Teil von `deploy.sh` — ein
  Auto-Restart kann eine Absturzursache verschleiern.
- **5. logrotate:** hartkodierte UID/Pfad ersetzt durch
  `ops/logrotate/beta-rag-mse.template` + `ops/logrotate/install.sh`, das `APP_DIR`,
  `APP_UID` und `APP_GID` einsetzt.
- **6. `prisma.config.ts`:** Seed-Kommando von `ts-node` auf `tsx` (Repo-Standard).
- **7. scripts-dist-Laufzeit-Abhängigkeiten:** Der Befund war **nicht latent, sondern
  live** — `zod`, `bcryptjs`, `sanitize-html`, `dotenv` und
  `@prisma/adapter-better-sqlite3` fehlten im Image vollständig (Next kompiliert sie in
  die Server-Chunks statt sie zu tracen). `prisma/seed.js` brach im Container mit
  `MODULE_NOT_FOUND` ab; ein Erststart mit `ALLOW_DB_SEED=true` wäre in eine Crash-Loop
  gelaufen. `scripts/bundle-script-deps.mjs` zieht die Pakete samt transitiver
  Abhängigkeiten nach, `scripts/check-script-deps.mjs` ist das Gate davor; beide sind
  in `deploy.sh` verdrahtet. Im Container gegengeprüft: Seed läuft durch.
- **8. ADR-Kandidaten:** ADR 0004 (Migrations-Runner), 0005 (Outbox), 0006
  (In-Process-Rate-Limiting), 0007 (Proof-Token), 0008 (Rollback-Politik), 0009
  (bewusste Deploy-Downtime).

Teilweise erledigt:

- **2. Backups:** Die fehlende Obergrenze für Monats-Backups ist umgesetzt
  (`MONTHLY_KEEP`, Standard 12) und in `ops/BACKUP_OPTIONS.md` dokumentiert. Die
  **Off-Host-Kopie bleibt offen**, weil Ziel und Zugangsdaten noch nicht feststehen.

Zurückgestellt (abgestimmt):

- **1. Zero-Downtime-Deploy:** Blue-Green bleibt offen. Der Ist-Zustand ist als
  ADR 0009 festgehalten — inklusive der drei Annahmen, die zwei gleichzeitig laufende
  Instanzen brechen würden (In-Process-Rate-Limiting, Outbox-Worker, gemeinsame
  SQLite-Datei). Diese drei Punkte sind vor einem Blue-Green-Umbau zu lösen.

### 2026-08-04 — Review-Korrekturen

- **Healthcheck-Units waren als System-Units unbrauchbar.** `User=1000` ohne
  `XDG_RUNTIME_DIR` findet den rootless Podman-Storage nicht; der Healthcheck wäre
  bei *jedem* Lauf fehlgeschlagen und hätte alle zwei Minuten einen **gesunden**
  Container neu gestartet. Jetzt User-Units, `ops/HEALTHCHECK.md` entsprechend.
- **`ExecStopPost` prüfte `$EXIT_STATUS`**, das systemd nicht immer setzt — ein leerer
  Wert hätte auch nach erfolgreichem Lauf neu gestartet. Jetzt `$SERVICE_RESULT`.
- **`MONTHLY_KEEP=0` hätte sämtliche Monats-Backups gelöscht** (`head -n 0` gibt nichts
  aus), ein nicht-numerischer Wert die Aufbewahrung abgebrochen. Jetzt Prüfung vorab,
  bevor überhaupt ein Backup geschrieben wird.
- **`printf … | grep -qxF` unter `set -o pipefail`:** `grep -q` beendet sich beim ersten
  Treffer, das schreibende `printf` bekäme SIGPIPE, und die Bedingung gälte als nicht
  erfüllt — ein zu behaltendes Backup wäre gelöscht worden. Jetzt Herestring.
- Gemeinsame Logik der beiden Skript-Abhängigkeits-Werkzeuge nach
  `scripts/lib/script-deps.mjs` gezogen; sie müssen im Gleichschritt bleiben, sonst
  gäbe das Gate Pakete frei, die der Bundler nie kopiert hat.
- `optionalDependencies` werden mitkopiert; nicht auffindbare Pakete brechen den
  Bundler nicht mehr ab, sondern werden gemeldet (das Gate schlägt danach ohnehin zu).

### 2026-08-04 — Versionskonflikte im Bundle sichtbar gemacht

Das Bundle hat ein flaches `node_modules` und kann nur **eine** Fassung je Paket
halten; pnpm hält dagegen je Anforderer eine eigene vor. Der Bundler nahm stillschweigend
die zuerst gefundene und übersprang bereits vorhandene Pakete ohne Versionsvergleich.

Er meldet jetzt beide Fälle: konkurrierende Anforderer und eine bereits von Next
getracte Fassung, die von der aufgelösten abweicht.

**Gefunden wurde dabei ein echter Konflikt:** `entities` — `htmlparser2` löst 7.0.1 auf,
`dom-serializer` verlangt 4.5.0; im Bundle liegt 7.0.1. Beide gehören zum
`sanitize-html`-Baum. Gegengeprüft: `sanitize-html` läuft im Bundle korrekt durch
(Tags gefiltert, Entities richtig kodiert), der Konflikt ist derzeit also folgenlos.

Bewusst **kein Abbruch**: Ein Versionsunterschied ist häufig ein Patch-Stand ohne
Wirkung, und ein harter Fehler würde das Deployment für einen bloßen Verdacht anhalten.
Das Gate bleibt bei fehlenden Paketen — dort ist der Schaden eindeutig.
