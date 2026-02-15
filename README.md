# RAG Schießsport MSE - Website

Website für die RAG Schießsport MSE mit Mitgliederverwaltung, Admin-gestellten Terminen, Abstimmungen, News und Kontaktformular.

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **Database**: SQLite (via Prisma ORM)
- **Testing**: Jest + React Testing Library
- **Authentication**: NextAuth
- **Deployment**: Docker + Docker Compose

## Lokale Entwicklung

### Voraussetzungen

- Node.js 22 LTS+ und pnpm
- Docker und Docker Compose (für Datenbank-Container)

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
- SMTP-Konfiguration für Kontaktformular
- Admin-E-Mail-Adressen

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

### Datenbank-Seed (Initialer Admin-User)

Der Seed-Script erstellt einen initialen Admin-User in der Datenbank:

```bash
pnpm run db:seed
```

**WICHTIG: Umgebung-Variablen werden automatisch aus `.env` geladen**

Der Seed-Script verwendet `dotenv`, Umgebungsvariablen werden automatisch aus der `.env`-Datei im Projektverzeichnis geladen. Sie müssen also keine `export`-Befehle verwenden.

Standardwerte (falls SEED_ADMIN_* nicht in `.env` gesetzt sind):
- Email: `admin@rag-mse.de`
- Passwort: `AdminPass123` (WARNUNG: Dies ist ein unsicheres Standardpasswort!)
- Name: `Administrator`

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
| Docker Compose | Aus `docker-compose.yml` environment mapping |
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
VALUES ('admin001', 'admin@rag-mse.de', '<BCRYPT_HASH_AUS_SCHRITT_2>', 'Administrator', 'ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

4. Überprüfen:
```sql
SELECT id, email, name, role FROM User;
```

**HINWEIS:** Die Datei `create_admin.sql` enthält eine kommentierte Vorlage für diesen Prozess. Diese Methode ist nur für fortgeschrittene Benutzer gedacht, die volle Kontrolle über die Datenbank benötigen.

## Datenbank-Setup

Die Datenbank wird initial mit dem gesquashten Skript `create_admin.sql` erstellt.
Schema-Aenderungen werden in der Entwicklung per `db:push` angewendet. Details siehe
[MIGRATIONS.md](./MIGRATIONS.md).

### Datenbank-Operationen in Produktion

Aus Sicherheitsgründen sind automatische Datenbank-Operationen (`db push` und `db seed`)
in der Produktion standardmäßig deaktiviert.

**WICHTIG:** In der Produktion werden folgende Umgebungsvariablen benötigt, um Datenbank-Operationen zu aktivieren:

- `ALLOW_DB_PUSH=true` - Aktiviert `prisma db push` (Schema-Änderungen)
- `ALLOW_DB_SEED=true` - Aktiviert `pnpm run db:seed` (Initialer Admin-User)

#### Empfohlener Migrations-Pfad für Produktion

1. **Schema-Änderungen:**
   ```bash
   # Auf dem Development-Server Änderungen an prisma/schema.prisma vornehmen
   pnpm run db:push

   # Schema-Änderungen testen
   pnpm run test

   # Für Produktion: Migrations-Skript erstellen oder manuell anwenden
   ```

2. **Produktion aktualisieren:**
   ```bash
   # Container stoppen
   docker-compose down

   # Datenbank sichern (online-backup, gzip, retention)
   ./scripts/backup-sqlite.sh

   # Nur wenn Schema-Änderungen erforderlich:
   docker-compose up -d
   docker-compose exec app sh -c "ALLOW_DB_PUSH=true pnpm exec prisma db push"

   # Für initiale Daten (nur beim ersten Setup):
   docker-compose exec app sh -c "ALLOW_DB_SEED=true pnpm run db:seed"

   # Container neu starten
   docker-compose restart app
   ```

3. **Verifikation:**
   ```bash
   # Logs prüfen
   docker-compose logs -f app

   # Gesundheitstest
   curl http://localhost:3000/api/health
   ```

**SICHERHEITSHINWEIS:**
- Stellen Sie immer ein Backup der Datenbank her, bevor Sie Schema-Änderungen anwenden
- Verwenden Sie `ALLOW_DB_PUSH` und `ALLOW_DB_SEED` nur mit Bedacht in der Produktion
- Testen Sie alle Schema-Änderungen in einer Staging-Umgebung vor dem Produktions-Einsatz

## Docker Compose

Docker Compose wird verwendet, um die Anwendung mit allen Abhängigkeiten zu betreiben:
- **App Container**: Next.js Anwendung
- **Redis**: Für verteiltes Rate-Limiting
- **Persistent Volumes**: SQLite-Datenbank und Redis-Daten

### Mit Docker Compose starten

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

Starten Sie dann die Anwendung:

```bash
docker-compose up -d
```

Hinweis: Der Dockerfile nutzt BuildKit-Cache fuer pnpm. Falls BuildKit deaktiviert ist, bauen Sie so:

```bash
DOCKER_BUILDKIT=1 docker-compose up -d --build
```

### pnpm Store auf dem Host teilen (schnellere Builds)

Standard: `.pnpm-store` im Projektverzeichnis (wird in den Build-Kontext aufgenommen). Legen Sie das Verzeichnis einmal an und nutzen Sie es in Builds:

```bash
mkdir -p .pnpm-store
DEPS_STAGE=deps-hostcache PNPM_STORE_DIR=.pnpm-store DOCKER_BUILDKIT=1 docker-compose build app
```

Optional koennen Sie ein eigenes Cache-Verzeichnis verwenden (Docker muss Zugriff auf den Host-Pfad haben):

```bash
mkdir -p /pfad/zum/pnpm-store
DEPS_STAGE=deps-hostcache PNPM_STORE_DIR=/pfad/zum/pnpm-store DOCKER_BUILDKIT=1 docker-compose build app
```

### Volume persistenz

Die SQLite-Datenbankdatei wird im lokalen `./data`-Verzeichnis gespeichert, um Datenverluste bei Container-Neustarts zu vermeiden.
Für Backups in Produktion wird das Skript `scripts/backup-sqlite.sh` verwendet (SQLite Online Backup + gzip + Retention).
Die Betriebsoptionen (systemd/cron/ZFS) sind in `ops/BACKUP_OPTIONS.md` dokumentiert.

```bash
# Backup jetzt ausfuehren
./scripts/backup-sqlite.sh

# Restore-Beispiel (Dateiname anpassen)
gunzip -c /zfs/backups/beta-rag-mse/prod.db.YYYY-MM-DD.sqlite3.gz > data/prod.db
```

### Container stoppen

```bash
docker-compose down
```

### Logs anzeigen

```bash
docker-compose logs -f app
```

### Container neu starten

```bash
docker-compose restart app
```

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

### Docker-Netzwerk-Konfiguration

Wenn HAProxy auf demselben Server wie Docker läuft, müssen Sie sicherstellen, dass HAProxy auf den Docker-Container zugreifen kann.

**Option 1: Host-Port-Mapping (empfohlen für einfache Setups)**

Die `docker-compose.yml` verwendet bereits Port-Mapping (`3000:3000`), sodass HAProxy über `127.0.0.1:3000` auf die Anwendung zugreifen kann.

**Option 2: Docker-Bridge-Netzwerk**

```bash
# Docker-Netzwerk erstellen
docker network create --driver bridge rag-mse-network

# docker-compose.yml anpassen:
networks:
  rag-mse-network:
    external: true

# HAProxy-Config anpassen:
server app1 rag-mse-app:3000 check inter 5s rise 2 fall 3
```

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

- Prüfen Sie, ob der Docker-Container läuft: `docker-compose ps`
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
TRUSTED_PROXY_IPS="127.0.0.0/8,10.0.0.0/8,192.168.0.0/16"

# Redis für verteilte Rate-Limits
REDIS_URL="redis://localhost:6379"

# Datenbank-Operationen in Produktion (SICHERHEIT!)
ALLOW_DB_PUSH=false     # Erlaubt prisma db push in Produktion
ALLOW_DB_SEED=false     # Erlaubt pnpm run db:seed in Produktion

# Anwendungseinstellungen
APP_NAME="RAG Schießsport MSE"
APP_URL="http://localhost:3000"
APP_TIMEZONE="Europe/Berlin"

# Termin-Benachrichtigungen
EVENT_REMINDER_POLL_INTERVAL_MS="3600000"
NOTIFICATION_TOKEN_VALIDITY_DAYS="60"

# Container-User für Docker (muss Schreibrechte auf ./data haben)
APP_UID="1000"
APP_GID="1000"
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
- Rollenbasierte Zugriffskontrolle (Admin vs. Mitglied)
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

- Benutzer erstellen, bearbeiten und löschen
- Rollenverwaltung (Admin/Mitglied) inkl. Schutz vor Löschung des letzten Admins
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

- Mitglieder können persönliche E-Mail-Erinnerungen für offene Terminanmeldungen im Profil konfigurieren
- Erinnerung erfolgt per Token-Link zur Anmeldung (`/anmeldung/[token]`)
- Abmeldung von Erinnerungen per Token-Link (`/benachrichtigungen/abmelden/[token]`)
- RSVP-Links unterstützen direkte Zu-/Absage ohne Login (`/api/notifications/rsvp/[token]`)
- Adminansicht für Benachrichtigungs-Verlauf der letzten 30 Tage (`/admin/benachrichtigungen`)
- Outbox-basierter E-Mail-Versand mit Retry-Logik und Admin-Einsicht (`/admin/e-mail-versand`)

### Datenschutz und Rechtliches

- Impressum (Inhalte durch Organisation bereitgestellt)
- Datenschutzerklärung (Inhalte durch Organisation bereitgestellt)
- Cookie-Banner (falls Cookies verwendet werden)

## Deployment

Die Anwendung wird hinter einem Reverse Proxy (z.B. HAProxy) auf einem VPS bereitgestellt.

> Die Deployment-Konfiguration ist vollständig implementiert und produktiv im Einsatz.
> Siehe AGENTS.md für die produktive Behandlung der docker-compose.yml.

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
- Prüfen Sie nach dem Start: `docker compose exec -T app id` (muss die erwartete UID:GID anzeigen)

## Backup-Strategie

Die SQLite-Datenbank wird in einem Docker-Volume gespeichert, das auf ein lokales Verzeichnis gemountet wird. Regelmäßige Backups der Datenbankdatei werden empfohlen.

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
