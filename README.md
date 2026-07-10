# RAG Schießsport MSE - Website

Website für die RAG Schießsport MSE mit Mitgliederverwaltung, Admin-gestellten Terminen, Abstimmungen, News und Kontaktformular.

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **Database**: SQLite (via Prisma ORM)
- **Testing**: Jest + React Testing Library
- **Authentication**: NextAuth
- **Deployment**: rootless Podman + podman-compose

## Lokale Entwicklung

### Voraussetzungen

- Node.js 22 LTS+ und pnpm
- Podman und podman-compose (für den vollständigen lokalen Stack)

### Installation

1. Repository klonen und Dependencies installieren:

```bash
pnpm install
```

2. Umgebungsvariablen konfigurieren:

```bash
cp .env.example .env
```

Die `.env`-Datei enthält alle benötigten Konfigurationen:

- Datenbank-URL
- NextAuth Secret und URL
- App-URLs und Zeitzone
- SMTP-Konfiguration für Kontaktformular
- Admin-E-Mail-Adressen
- Proxy-Konfiguration

### Entwicklungserver starten

```bash
pnpm run dev
```

Die Anwendung läuft unter `http://localhost:3000`.

### Verfügbare Skripte

- `pnpm run dev` - Startet den Entwicklungsserver
- `pnpm run build` - Erstellt Produktions-Build
- `pnpm run start` - Startet Produktionsserver
- `pnpm run lint` - Führt ESLint aus
- `pnpm run format` - Formatiert Code mit Prettier
- `pnpm test` - Führt alle Tests aus
- `pnpm run test:watch` - Führt Tests im Watch-Modus aus
- `pnpm run test:coverage` - Führt Tests mit Coverage aus

### Datenbank-Seed (initialer Site-Administrator)

Der Seed-Script erstellt einen initialen Benutzer mit der Rolle `SITE_ADMINISTRATOR` in der Datenbank:

```bash
pnpm run db:seed
```

**WICHTIG: Umgebung-Variablen werden automatisch aus `.env` geladen**

Der Seed-Script verwendet `dotenv`, Umgebungsvariablen werden automatisch aus der `.env`-Datei im Projektverzeichnis geladen. Sie müssen also keine `export`-Befehle verwenden.

Es gibt keine Standard-Credentials: Fehlen `SEED_ADMIN_EMAIL` oder `SEED_ADMIN_PASSWORD`,
überspringt das Skript das Anlegen des Admin-Benutzers mit einer Warnung.

**Empfohlene Vorgehensweise:**

1. Setzen Sie die Seed-Admin-Variablen in Ihrer `.env`-Datei:
```bash
SEED_ADMIN_EMAIL="admin@rag-mse.de"
SEED_ADMIN_PASSWORD="IhrSicheresPasswort123"
SEED_ADMIN_NAME="Administrator"
```

2. Führen Sie den Seed-Script aus:
```bash
pnpm run db:seed
```

**WICHERHEITSWARNUNG:**
- Ändern Sie das Standardpasswort `AdminPass123` immer vor der ersten Verwendung!
- Verwenden Sie ein starkes Passwort (mindestens 8 Zeichen mit Groß-/Kleinschreibung und Ziffern)
- Ändern Sie das Passwort nach dem ersten Login sofort!

**Umgebungsvariablen-Loading in verschiedenen Kontexten:**

| Kontext | Wie werden `.env`-Variablen geladen? |
|---------|-------------------------------------|
| Lokal mit `pnpm run db:seed` | Automatisch via `dotenv` aus `.env` |
| Lokal mit `pnpm run dev` | Automatisch via Next.js aus `.env` |
| podman-compose | Aus `compose.yaml` environment mapping |
| Direkter `tsx prisma/seed.ts` Aufruf | Automatisch via `dotenv` aus `.env` |

### Weitere Datenbank-Skripte

- `pnpm run db:push` - Push Schema Changes direkt zur Datenbank (Entwicklung)
- `pnpm run db:studio` - Öffnet Prisma Studio zur Datenbank-Ansicht

### Alternative Methode: Manuelle Admin-Erstellung per SQL

Als Alternative zum Seed-Script können Sie einen Admin-Benutzer auch manuell direkt in der Datenbank erstellen:

1. Datenbank mit SQLite öffnen:
```bash
sqlite3 ./data/dev.db
```

2. Passwort-Hash generieren (Node.js):
```bash
node -e "console.log(require('bcryptjs').hashSync('IhrPasswort123', 10))"
```

3. Admin-Benutzer in Datenbank einfügen:
```sql
INSERT INTO User (id, email, password, name, role, createdAt, updatedAt)
VALUES ('admin001', 'admin@rag-mse.de', '<BCRYPT_HASH_AUS_SCHRITT_2>', 'Administrator', 'SITE_ADMINISTRATOR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

4. Überprüfen:
```sql
SELECT id, email, name, role FROM User;
```

**HINWEIS:** Die Datei `create_admin.sql` enthält eine kommentierte Vorlage für diesen Prozess. Diese Methode ist nur für fortgeschrittene Benutzer gedacht, die volle Kontrolle über die Datenbank benötigen.

## Datenbank-Setup

Für frische Datenbanken verwendet `pnpm run db:migrate` intern die Baseline aus `create_admin.sql`
und wendet anschließend die SQL-Migrationskette aus `prisma/migrations/*/migration.sql` an.
Im normalen Betrieb müssen Sie `create_admin.sql` daher nicht manuell ausführen. Details siehe
[MIGRATIONS.md](./MIGRATIONS.md).

### Datenbank-Operationen in Produktion

In Produktion ist `prisma db push` nicht Teil des vorgesehenen Betriebswegs. Verwenden Sie
versionsgeführte SQL-Migrationen (`pnpm run db:migrate`), die beim Containerstart automatisch
ausgeführt werden. Das Seed-Skript wird nur bei leerer Datenbank und `ALLOW_DB_SEED=true`
automatisch gestartet.

**WICHTIG:** Für das initiale Seeding in Produktion werden folgende Umgebungsvariablen benötigt:

- `ALLOW_DB_SEED=true` - aktiviert `pnpm run db:seed` beim ersten Start mit leerer Datenbank
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` - müssen dabei explizit und sicher gesetzt sein

#### Empfohlener Migrations-Pfad für Produktion

1. **Schema-Änderungen:**
   ```bash
   # Schema anpassen und neue SQL-Migration unter prisma/migrations anlegen

   # Migration lokal anwenden und testen
   pnpm run db:migrate
   pnpm run test

   # Optional zusätzlich Lint/Build lokal prüfen
   pnpm run lint
   pnpm run build
   ```

2. **Produktion aktualisieren:**
   ```bash
   # Datenbank sichern (online-backup, gzip, retention)
   ./scripts/backup-sqlite.sh

   # Aktualisierte Anwendung bereitstellen
   podman-compose up -d

   # Migrationen laufen beim Containerstart automatisch
   ```

3. **Verifikation:**
   ```bash
   # Logs prüfen
   podman-compose logs -f app

   # Gesundheitstest
   curl http://localhost:3000/api/health
   ```

**SICHERHEITSHINWEIS:**
- Stellen Sie immer ein Backup der Datenbank her, bevor Sie Schema-Änderungen anwenden
- Verwenden Sie `ALLOW_DB_SEED` nur beim initialen Setup und entfernen Sie die Variable danach wieder
- Testen Sie alle Schema-Änderungen in einer Staging-Umgebung vor dem Produktions-Einsatz

## Container-Betrieb (rootless Podman)

podman-compose wird verwendet, um die Anwendung mit allen Abhängigkeiten zu betreiben:
- **App Container**: Next.js Anwendung
- **Rate-Limiting**: In-Process (im Arbeitsspeicher der App), kein externer Dienst nötig
- **Persistente Volumes**: SQLite-Datenbank

> Migrieren Sie einen bestehenden Docker-Stack? Siehe den
> [Migrationsleitfaden Docker → rootless Podman](DOCKER_TO_PODMAN_MIGRATION.md).

### Mit podman-compose starten

Erstellen Sie zuerst ein lokales Datenverzeichnis und kopieren Sie die Umgebungsvariablen:

```bash
mkdir -p data
cp .env.example .env
```

Passen Sie die `.env`-Datei für die Produktion an, insbesondere:

```bash
NEXTAUTH_SECRET="CHANGE_ME_STRONG_SECRET_MIN_32_CHARS"
NEXTAUTH_URL="https://ihr-domain.de"
COOKIE_SECURE="true"
```

**WICHTIG:**
- `NEXTAUTH_SECRET` MUSS mit einem starken, zufälligen Wert gesetzt werden (mindestens 32 Zeichen)
- Alle Secrets müssen in der Produktion gesetzt sein, sonst startet die Anwendung nicht

Das Runtime-Image (`Containerfile`) enthält ausschließlich die fertigen Build-Artefakte;
der Next.js-Build läuft auf dem Host. Erzeugen Sie die Artefakte daher vor dem ersten Start:

```bash
pnpm install --frozen-lockfile
pnpm exec prisma generate
pnpm run build:scripts
pnpm run build
```

Starten Sie dann die Anwendung (rootless):

```bash
podman-compose up -d
```

`compose.yaml` baut das Image aus `Containerfile` und kopiert die zuvor erzeugten
Artefakte hinein. Der host-seitige bind mount `./data` bleibt dank
`userns_mode: keep-id` für den Container-Benutzer schreibbar. Für den produktiven
Rollout übernimmt `deploy.sh` Build, Backup, Health-Checks und Neustart automatisch.

Damit der Stack nach einem Reboot automatisch startet, kann die rootless
systemd-User-Unit `ops/systemd/rag-mse.service` installiert werden (siehe Kommentar
im Unit-File; benötigt `loginctl enable-linger`).

### Volume persistenz

Die SQLite-Datenbankdatei wird im lokalen `./data`-Verzeichnis gespeichert, um Datenverluste bei Container-Neustarts zu vermeiden.
Für Backups in Produktion wird das Skript `scripts/backup-sqlite.sh` verwendet (SQLite Online Backup + gzip + Retention).
Die Betriebsoptionen (systemd/cron/ZFS) sind in `ops/BACKUP_OPTIONS.md` dokumentiert.
Hochgeladene Dokumente liegen standardmäßig unter `./data/documents` und sollten zusammen mit der Datenbank gesichert werden.

```bash
# Backup jetzt ausfuehren
./scripts/backup-sqlite.sh

# Restore-Beispiel (Dateiname anpassen)
gunzip -c /zfs/backups/beta-rag-mse/prod.db.YYYY-MM-DD.sqlite3.gz > data/prod.db
```

### Container stoppen

```bash
podman-compose down
```

### Logs anzeigen

```bash
podman-compose logs -f app
```

### Container neu starten

```bash
podman-compose restart app
```

### Erstes Produktions-Setup

Wenn Sie eine leere Produktionsdatenbank initialisieren wollen, setzen Sie `ALLOW_DB_SEED="true"` nur temporaer und nur zusammen mit expliziten, sicheren Werten fuer `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` und `SEED_ADMIN_NAME`. Platzhalter- oder Standardwerte werden beim Produktionsstart abgewiesen.

## HAProxy Reverse Proxy Konfiguration

Für die Produktion wird empfohlen, einen Reverse Proxy wie HAProxy vor der Anwendung zu verwenden. HAProxy übernimmt SSL/TLS-Terminierung, Sicherheitsoptionen und Load Balancing.

### HAProxy Installation

**Debian/Ubuntu:**

```bash
sudo apt update
sudo apt install haproxy
```

**RHEL/CentOS:**

```bash
sudo yum install haproxy
```

### Konfiguration

1. Kopieren Sie die HAProxy-Beispielkonfiguration:

```bash
sudo cp haproxy.cfg.example /etc/haproxy/haproxy.cfg
```

2. Bearbeiten Sie die Konfiguration nach Ihren Anforderungen:

```bash
sudo nano /etc/haproxy/haproxy.cfg
```

**Wichtige Anpassungen:**

- SSL-Zertifikat: Platzieren Sie Ihr SSL-Zertifikat als `/etc/ssl/haproxy/rag-mse.pem` (vollständige Zertifikatskette + privater Schlüssel)
- Backend-IP: Prüfen Sie die Backend-Server-IP im Abschnitt `backend rag-mse-app`
- Stats-Passwort: Ändern Sie das Passwort für die Statistik-Seite

3. Testen Sie die Konfiguration:

```bash
sudo haproxy -c -f /etc/haproxy/haproxy.cfg
```

4. Starten Sie HAProxy:

```bash
sudo systemctl start haproxy
sudo systemctl enable haproxy
```

### SSL/TLS Zertifikate

Für HTTPS benötigen Sie ein SSL/TLS-Zertifikat. Empfohlene Optionen:

**Let's Encrypt (kostenlos):**

```bash
sudo apt install certbot

# Zertifikat anfordern
sudo certbot certonly --standalone -d ihre-domain.de -d www.ihre-domain.de

# Zertifikate für HAProxy zusammenfügen
sudo cat /etc/letsencrypt/live/ihre-domain.de/fullchain.pem \
         /etc/letsencrypt/live/ihre-domain.de/privkey.pem \
         | sudo tee /etc/ssl/haproxy/rag-mse.pem

# Zertifikat erneuern (automatisch via Cron)
sudo crontab -e
```

Fügen Sie diesen Cron-Job für automatische Erneuerung hinzu:

```
0 3 * * * certbot renew --quiet && cat /etc/letsencrypt/live/ihre-domain.de/fullchain.pem /etc/letsencrypt/live/ihre-domain.de/privkey.pem | tee /etc/ssl/haproxy/rag-mse.pem && systemctl reload haproxy
```

**Kommerzielles Zertifikat:**

1. Kaufen Sie ein Zertifikat von einem CA (z.B. DigiCert, Let's Encrypt for Business)
2. Erstellen Sie die `.pem`-Datei:

```bash
sudo cat ihr-domain.de.crt \
         intermediate-ca.crt \
         root-ca.crt \
         ihr-domain.de.key \
         | sudo tee /etc/ssl/haproxy/rag-mse.pem

# Berechtigungen setzen
sudo chmod 600 /etc/ssl/haproxy/rag-mse.pem
```

### Podman-Netzwerk-Konfiguration

Wenn HAProxy auf demselben Server wie Podman läuft, greift es über den vom Container
veröffentlichten Loopback-Port auf die Anwendung zu.

**Host-Port-Mapping (verwendetes Setup)**

`compose.yaml` veröffentlicht den App-Port auf `127.0.0.1:3000`, sodass HAProxy über
`127.0.0.1:3000` auf die Anwendung zugreifen kann (siehe `haproxy.cfg.example`).

**Trusted Proxy / Client-IP**

Unter rootless Podman unterscheidet sich die im Container sichtbare Quell-IP von Docker.
Setzen Sie `TRUSTED_PROXY_IPS` passend (Default in `compose.yaml`:
`127.0.0.1/32,::1,10.0.2.0/24,10.88.0.0/16`) und prüfen Sie nach dem ersten Deploy die
tatsächlich beobachtete Quell-IP, damit Rate-Limiting und Client-IP-Logging korrekt
funktionieren. Erscheint die Quell-IP als Podman-Gateway, kann der App-Container
alternativ mit Host-Networking (`network_mode: host`) betrieben werden.

### Deployment-Selbsttest (`/api/selftest`)

Neben dem flachen Liveness-Check `/api/health` (nur `SELECT 1`) gibt es einen tiefen,
**zustandsfreien** Selbsttest, der nach einem Deploy alle wichtigen Teilsysteme prüft:
Datenbank-Verbindung und angewendete Migrationen, Vorhandensein kritischer Daten
(mind. ein `SITE_ADMINISTRATOR`), Dokumentenspeicher (Verzeichnis beschreibbar, Dateien
vorhanden), SMTP (Live-`verify()` ohne E-Mail-Versand), Hintergrund-Worker, Konfiguration
und freier Speicherplatz. Es werden ausschließlich lesende Operationen ausgeführt – keine
Daten werden verändert und keine E-Mail versendet.

Der Endpunkt ist über ein Bearer-Token (`SELFTEST_TOKEN`) geschützt. Ohne gesetztes Token
antwortet er mit `503 self-test not configured` und führt keinen Test aus.

```bash
curl -i -H "Authorization: Bearer $SELFTEST_TOKEN" http://localhost:3000/api/selftest
```

Status-Codes:

- **200** `{"status":"ok", ...}` – alles in Ordnung.
- **200** `{"status":"warn", "warnings":[...]}` – nur nicht-kritische Hinweise (z. B. wenig
  Speicherplatz, fehlgeschlagene E-Mails in der Warteschlange).
- **503** `{"status":"error", "errors":[...]}` – mindestens ein Teilsystem ist defekt.
- **401** – Token fehlt oder ist falsch.

Jede Prüfung erscheint im JSON unter `checks[]` mit `name`, `component` (das betroffene Teil
der Anwendung), `status` und `message`. Die Felder `warnings[]`/`errors[]` fassen die
Probleme samt betroffenem `component` zusammen.

Details zu geprüften Teilsystemen und Design-Entscheidungen: siehe [`docs/SELFTEST.md`](docs/SELFTEST.md).

### HAProxy Monitoring

HAProxy stellt eine Statistik-Seite bereit (standardmäßig auf Port 8404):

```bash
# Im Browser öffnen
http://ihre-domain.de:8404/stats

# Login mit konfigurierten Credentials
User: admin
Password: CHANGEME_PASSWORD
```

### HAProxy Logs

```bash
# Logs anzeigen
sudo tail -f /var/log/haproxy.log

# Debug-Modus aktivieren (temporär)
sudo systemctl stop haproxy
sudo haproxy -d -f /etc/haproxy/haproxy.cfg
```

### HAProxy konfigurieren für Load Balancing (optional)

Bei mehreren Instanzen der Anwendung:

```
backend rag-mse-app
    mode http
    balance roundrobin
    option httpchk GET /api/health

    server app1 127.0.0.1:3000 check inter 5s rise 2 fall 3
    server app2 127.0.0.1:3001 check inter 5s rise 2 fall 3
    server app3 127.0.0.1:3002 check inter 5s rise 2 fall 3
```

### Troubleshooting

**HAProxy startet nicht:**

```bash
# Konfiguration testen
sudo haproxy -c -f /etc/haproxy/haproxy.cfg

# Logs prüfen
sudo journalctl -xe -u haproxy
```

**502 Bad Gateway:**

- Prüfen Sie, ob der Container läuft: `podman-compose ps`
- Überprüfen Sie die Backend-IP in der HAProxy-Konfiguration
- Prüfen Sie die HAProxy-Logs: `sudo tail -f /var/log/haproxy.log`

**SSL-Zertifikat-Probleme:**

```bash
# Zertifikatsdatei prüfen
sudo openssl x509 -in /etc/ssl/haproxy/rag-mse.pem -text -noout

# Zertifikat und Schlüssel zusammengehören
sudo openssl x509 -noout -modulus -in /etc/ssl/haproxy/rag-mse.pem | openssl md5
sudo openssl rsa -noout -modulus -in /etc/ssl/haproxy/rag-mse.pem | openssl md5
```

### NextAuth und HAProxy

Für die korrekte Funktion von NextAuth hinter HAProxy ist es wichtig, dass die folgenden Header korrekt gesetzt sind:

```haproxy
http-request set-header X-Forwarded-Proto https if { ssl_fc }
http-request set-header X-Forwarded-Proto http if !{ ssl_fc }
http-request set-header X-Forwarded-Host %[req.hdr(Host)]
```

Diese sind bereits in der Beispielkonfiguration enthalten. Stellen Sie sicher, dass `NEXTAUTH_URL` in der `.env`-Datei auf die HTTPS-URL zeigt:

```
NEXTAUTH_URL="https://ihre-domain.de"
```

## Projektstruktur

```
site-rag-mse/
├── app/              # Next.js App Router Seiten und Layouts
├── components/       # React-Komponenten
├── lib/             # Hilfsfunktionen und Utilities
├── types/           # TypeScript-Type-Definitionen
├── public/          # Statische Assets (Bilder, Logo, etc.)
├── __tests__/       # Testdateien
├── .env.example     # Vorlage für Umgebungsvariablen
└── package.json     # Projektabhängigkeiten
```

## Testing

Das Projekt verwendet Jest und React Testing Library für Unit- und Integrationstests.

### Tests ausführen

```bash
# Alle Tests einmalig ausführen
pnpm test

# Tests im Watch-Modus
pnpm run test:watch

# Tests mit Coverage
pnpm run test:coverage
```

### Teststruktur

Testdateien befinden sich im `__tests__`-Verzeichnis und folgen der Benennungskonvention `*.test.tsx` oder `*.test.ts`.

## Code-Standards

- **ESLint**: Für Linting und Code-Qualität
- **Prettier**: Für konsistente Code-Formatierung
- **TypeScript**: Für Typsicherheit

### Linting und Formatierung

```bash
# Linting prüfen
pnpm run lint

# Code formatieren
pnpm run format
```

### Abhängigkeiten aktuell halten

```bash
# Veraltete Pakete anzeigen
pnpm outdated

# Pakete innerhalb ihres Major-Bereichs aktualisieren
pnpm update --latest <paket>
```

Nach jedem Update von `prisma`/`@prisma/client` muss der Client neu generiert werden
(`pnpm exec prisma generate`); `deploy.sh` erledigt das für Produktions-Deployments
automatisch.

Stand 09.07.2026 bewusst **nicht** auf die jeweils neueste Major-Version gehoben, da
inkompatibel mit dem aktuellen Stack:

- **TypeScript** (5.9.x statt 6.x/7.x): Sowohl 6.0.3 als auch 7.0.2 brechen die
  generierten Typen von `@prisma/client` 7.8 (`has no exported member 'PrismaClient'` u.a.)
  in ca. 60 Stellen im Code.
- **ESLint** (9.x statt 10.x): `eslint-plugin-react` 7.37.5 (transitive Abhängigkeit von
  `eslint-config-next`) ist nicht kompatibel mit ESLint 10 (`contextOrFilename.getFilename
  is not a function`).
- **Babel** `@babel/core`/`preset-env`/`preset-react`/`preset-typescript` (7.x statt 8.x):
  `@babel/preset-typescript` 8 kann `new Foo<Generic>()`-Syntax nicht mehr parsen, was in
  Jest-Tests zu Syntaxfehlern führt (91 von 134 Testsuiten schlugen fehl).

Vor einem erneuten Versuch prüfen, ob die Ökosysteme (Prisma-Typgenerierung,
`eslint-plugin-react`, `@babel/preset-typescript`) inzwischen nachgezogen haben.

### Wiederverwendbare UI-Komponenten

#### ConfirmDialog (Bestätigungsdialog)

Ersetzt native `window.confirm()`-Aufrufe durch gestylte Modal-Dialoge. Basiert auf dem Context + Provider Pattern mit Promise-basierter API.

**Setup:** Der `ConfirmDialogProvider` ist bereits in `components/providers.tsx` eingebunden und steht in der gesamten App zur Verfügung.

**Verwendung in Hooks und Komponenten:**

```tsx
import { useConfirmDialog } from "@/components/confirm-dialog";

function MyComponent() {
  const confirm = useConfirmDialog();

  const handleDelete = async () => {
    const confirmed = await confirm({
      message: "Eintrag wirklich löschen?",
      confirmLabel: "Löschen",      // Standard: "Bestätigen"
      cancelLabel: "Abbrechen",     // Standard: "Abbrechen"
      variant: "danger",            // "danger" | "warning" | "default"
    });

    if (!confirmed) return;
    // ... Löschlogik
  };
}
```

**Kurzform** für einfache Bestätigungen:

```tsx
const confirmed = await confirm("Wirklich fortfahren?");
```

**Varianten:**
- `"danger"` — Roter Bestätigen-Button (`btn-danger`), für destruktive Aktionen
- `"warning"` — Standard-Button (`btn-primary`), für wichtige aber nicht-destruktive Aktionen
- `"default"` — Standard-Button (`btn-primary`)

## Umgebungsvariablen

Alle Umgebungsvariablen werden in der `.env`-Datei konfiguriert. Kopieren Sie `.env.example` und passen Sie die Werte an.

```bash
# Datenbank (lokal)
DATABASE_URL="file:./data/dev.db"

# Authentifizierung
NEXTAUTH_SECRET="CHANGE_ME_STRONG_SECRET_MIN_32_CHARS"
NEXTAUTH_URL="http://localhost:3000"

# Email für Kontaktformular
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="CHANGE_ME_SMTP_PASSWORD"
SMTP_FROM="noreply@rag-mse.de"

# Admin-Empfänger (durch Komma getrennt)
ADMIN_EMAILS="admin1@example.com,admin2@example.com"

# Proxy-Trust für Rate-Limits (trusted proxy/source ranges)
TRUSTED_PROXY_IPS="127.0.0.1/32,172.16.0.0/12"
RATE_LIMIT_FAIL_OPEN="false"

# Datenbank-Operationen in Produktion (SICHERHEIT!)
ALLOW_DB_SEED=false     # Aktiviert einmaliges Seed beim ersten Start mit leerer DB

# Anwendungseinstellungen
APP_NAME="RAG Schießsport MSE"
APP_URL="http://localhost:3000"
APP_TIMEZONE="Europe/Berlin"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# Termin-Benachrichtigungen
EVENT_REMINDER_POLL_INTERVAL_MS="3600000"
NOTIFICATION_TOKEN_VALIDITY_DAYS="60"

# Container-User für rootless Podman (muss Schreibrechte auf ./data haben)
APP_UID="1000"
APP_GID="1000"

# Dokumentenverwaltung
DOCUMENTS_DIR="./data/documents"
DOCUMENT_UPLOAD_MAX_MB="15"
```

**WICHTIG:**
- Ersetzen Sie ALLE `CHANGE_ME_*`-Platzhalter mit Ihren eigenen Werten
- `NEXTAUTH_SECRET` muss mindestens 32 Zeichen lang sein und zufällig sein
- Verwenden Sie sichere SMTP-Passwörter
- In der Produktion: Alle Secrets müssen gesetzt werden, andernfalls startet die Anwendung nicht
- `APP_UID` und `APP_GID` müssen zur Owner-ID des gemounteten `./data`-Verzeichnisses passen

## Features

### Authentifizierung

- E-Mail/Passwort-Login mit NextAuth (Credentials)
- Rollenbasierte Zugriffskontrolle (`SITE_ADMINISTRATOR`, `ADMIN`, `AUDITOR`, `MEMBER`)
- Passwort zurücksetzen per E-Mail-Token
- Passwort ändern für eingeloggte Mitglieder
- Einladungseinlösung über Token-Link (keine öffentliche Registrierung)
- Schutzmechanismen: Rate Limiting und Origin/Referer-Prüfung für schreibende API-Requests

### Termine

- Öffentliche Terminliste und öffentliche Termindetailseiten
- Admins können Termine erstellen, bearbeiten und löschen
- Rich-Text-Beschreibungen mit Tiptap-Editor
- Event-Typen: Training und Wettkampf (optional)
- Standortunterstützung mit OpenStreetMap (Karte auf der Detailseite)
- Schießstand-Auswahl und Geocoding-Unterstützung im Admin-Formular
- Vergangene Termine auf separater Seite
- Abstimmung (Ja/Nein/Vielleicht) nur für eingeloggte Nutzer
- Eine Stimme pro Mitglied pro Termin, inklusive Rückzug der eigenen Stimme
- Abstimmungsergebnisse nur für eingeloggte Nutzer sichtbar

### Benutzerverwaltung (Admin)

- Benutzer anlegen, bearbeiten und löschen
- Neue Zugänge werden per Einladung vorbereitet; die Passwortvergabe erfolgt über den Einladungslink
- Rollenverwaltung (`ADMIN`, `AUDITOR`, `MEMBER`) inkl. Schutz vor Löschung des letzten Administrators
- Einladungen versenden und erneut versenden
- Erweiterte Profildaten verwalten (u.a. Adresse, Telefon, Geburtsdatum, Dienstgrad, Verbandsdaten)

### News

- Öffentliche News-Liste und Detailseiten
- Admins können News-Artikel erstellen, bearbeiten und löschen
- Veröffentlichungsstatus und Veröffentlichungsdatum steuerbar

### Kontaktformular

- Öffentliches Kontaktformular
- E-Mail-Versand an konfigurierte Administratoren
- Rate Limiting gegen Spam
- Serverseitige Validierung

### Benachrichtigungen

- Mitglieder können persönliche E-Mail-Erinnerungen für offene Terminanmeldungen über `/benachrichtigungen` konfigurieren
- Erinnerung erfolgt per Token-Link zur Anmeldung (`/anmeldung/[token]`)
- Abmeldung von Erinnerungen per Token-Link (`/benachrichtigungen/abmelden/[token]`)
- RSVP-Links unterstützen direkte Zu-/Absage ohne Login (`/api/notifications/rsvp/[token]`)
- Adminansicht für Benachrichtigungs-Verlauf der letzten 30 Tage (`/admin/benachrichtigungen`)
- Outbox-basierter E-Mail-Versand mit Retry-Logik und Admin-Einsicht (`/admin/e-mail-versand`)

### Rollen und Berechtigungen

Die Anwendung verwendet ein rollenbasiertes Zugriffskontrollsystem mit vier Rollen:

| Rolle | Beschreibung | Zuweisbar |
|-------|--------------|-----------|
| **SITE_ADMINISTRATOR** | Super-Admin mit vollen Rechten | Nein (nur via Datenbank/Migration) |
| **ADMIN** | Administrator mit vollem Zugriff auf Adminbereich | Ja |
| **AUDITOR** | Lesezugriff auf Adminbereich, kein Schreibzugriff | Ja |
| **MEMBER** | Einfaches Mitglied mit Zugriff auf Mitgliederbereich | Ja |

#### Berechtigungsübersicht

| Funktion | MEMBER | AUDITOR | ADMIN | SITE_ADMINISTRATOR |
|----------|--------|---------|-------|-------------------|
| Öffentliche Seiten | ✓ | ✓ | ✓ | ✓ |
| Mitglieder-Dokumente (lesen) | ✓ | ✓ | ✓ | ✓ |
| Mitglieder-Dokumente (verwalten) | ✗ | ✗ | ✓ | ✓ |
| Admin-Dokumente (lesen) | ✗ | ✓ | ✓ | ✓ |
| Admin-Dokumente (verwalten) | ✗ | ✗ | ✓ | ✓ |
| Admin-Bereich (lesen) | ✗ | ✓ | ✓ | ✓ |
| Admin-Bereich (verwalten) | ✗ | ✗ | ✓ | ✓ |
| Termine abstimmen | ✓ | ✓ | ✓ | ✓ |
| Eigenes Profil verwalten | ✓ | ✓ | ✓ | ✓ |

**Hinweis:** Die Rolle `SITE_ADMINISTRATOR` kann nicht über die Benutzeroberfläche vergeben werden. Sie wird ausschließlich über Datenbank-Migrationen oder direkte Datenbankänderungen gesetzt.

### Dokumentenverwaltung

Die Anwendung bietet zwei getrennte Dokumentenbereiche:

#### Admin-Dokumente (`/admin/dokumente`)
- **Zugriff:** ADMIN, SITE_ADMINISTRATOR (Vollzugriff), AUDITOR (nur Lesen)
- **Verwendung:** Interne Dokumente für die Vereinsführung
- **Funktionen:** Upload, Verzeichnisverwaltung, Bearbeitung, Löschen

#### Mitglieder-Dokumente (`/mitglieder-dokumente`)
- **Zugriff:** MEMBER, AUDITOR, ADMIN, SITE_ADMINISTRATOR
- **Verwendung:** Dokumente für alle Mitglieder (z. B. Formulare, Satzungen)
- **Funktionen für MEMBER/AUDITOR:** Nur Lesen und Herunterladen
- **Funktionen für ADMIN/SITE_ADMINISTRATOR:** Volle Verwaltung

#### Gemeinsame Features
- Upload, Suche, Vorschau und Download von Dokumenten
- Verzeichnisstruktur mit genau einer Ebene: Dokumente liegen im `Root` oder in einem Verzeichnis
- Verzeichnisse können im Adminbereich angelegt, umbenannt und gelöscht werden
- Dokumente können beim Upload einem Verzeichnis zugeordnet und später zwischen Root/Verzeichnissen verschoben werden

#### Verwaltung beider Bereiche
Administratoren verwalten die Bereiche über zwei getrennte Admin-Seiten:
- `/admin/dokumente` für Admin-Dokumente
- `/admin/mitglied-dokumente` für Mitglieder-Dokumente
- Beide Seiten verwenden dasselbe Bedienkonzept; Dokumente und Verzeichnisse bleiben strikt nach Bereich getrennt

### Datenschutz und Rechtliches

- Impressum (Inhalte durch Organisation bereitgestellt)
- Datenschutzerklärung (Inhalte durch Organisation bereitgestellt)
- Cookie-Banner (falls Cookies verwendet werden)

### Content Security Policy

- Die Produktions-CSP erlaubt bewusst `script-src 'self' 'unsafe-inline'`.
- Grund: Next.js App Router erzeugt Inline-Bootstrap-/Hydration-Skripte; ein striktes `script-src 'self'` deaktiviert interaktive UI wie Navigation, Menüs und Login-bezogene Client-Funktionen.
- Als Ausgleich ist die Policy an anderer Stelle gehärtet, insbesondere mit `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` und `frame-ancestors 'self'`.
- Jede spätere CSP-Verschärfung muss an einer realen Produktionsantwort verifiziert werden: keine blockierten Inline-Skripte in der Browser-Konsole und funktionsfähige interaktive Navigation.

## Deployment

Die Anwendung wird hinter einem Reverse Proxy (z.B. HAProxy) auf einem VPS bereitgestellt.

> Die Deployment-Konfiguration ist vollständig implementiert und produktiv im Einsatz.
> Siehe AGENTS.md für die produktive Behandlung der compose.yaml.

### Produktions-Build erstellen

```bash
pnpm run build
```

### Produktionsserver starten

```bash
pnpm start
```

### Wichtige Produktions-Einstellungen

In der Produktion folgende Umgebungsvariablen anpassen:

```bash
NEXTAUTH_SECRET="CHANGE_ME_STRONG_SECRET_MIN_32_CHARS_PRODUCTION"
NEXTAUTH_URL="https://ihr-domain.de"
COOKIE_SECURE="true"
APP_UID="1000"
APP_GID="1000"
```

**WICHTIG:**
- `NEXTAUTH_SECRET` MUSS mit einem starken, zufälligen Wert gesetzt werden (mindestens 32 Zeichen)
- Verwenden Sie HTTPS in der Produktion
- Alle oben genannten Secrets sind PFLICHT für den Produktionsbetrieb
- Prüfen Sie nach dem Start: `podman-compose exec -T app id` (muss die erwartete UID:GID anzeigen)

## Backup-Strategie

Die SQLite-Datenbank wird in einem host-gemounteten Volume (./data) gespeichert. Regelmäßige Backups der Datenbankdatei werden empfohlen.

## Lizenzen und Branding

- Logo: "Wir sind die Reserve" (aus dem Internet)
- Branding: Orientiert am RAG-Schießsport-Look
- Alle UI-Texte auf Deutsch

## Entwicklungshinweise

- Code sollte selbsterklärend sein, wenige Kommentare
- Best Practices und saubere Coding-Standards befolgen
- Alle neuen Features mit Tests abdecken
- TypeScript-Typen explizit definieren

## Support und Fragen

Für Fragen zur Entwicklung und zum Deployment kontaktieren Sie die Projekt-Administratoren.
