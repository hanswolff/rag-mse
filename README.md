# RAG Schießsport MSE - Website

Website für die RAG Schießsport MSE mit Mitgliederverwaltung, Admin-gestellten Terminen, Abstimmungen, News und Kontaktformular.

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **Database**: SQLite (via Prisma ORM, geplant)
- **Testing**: Jest + React Testing Library
- **Authentication**: NextAuth (geplant)
- **Deployment**: Docker + Docker Compose (geplant)

## Lokale Entwicklung

### Voraussetzungen

- Node.js 22 LTS+ und npm
- Docker und Docker Compose (für Datenbank-Container)

### Installation

1. Repository klonen und Dependencies installieren:

```bash
npm install
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
npm run dev
```

Die Anwendung läuft unter `http://localhost:3000`.

### Verfügbare Skripte

- `npm run dev` - Startet den Entwicklungsserver
- `npm run build` - Erstellt Produktions-Build
- `npm run start` - Startet Produktionsserver
- `npm run lint` - Führt ESLint aus
- `npm run format` - Formatiert Code mit Prettier
- `npm test` - Führt alle Tests aus
- `npm run test:watch` - Führt Tests im Watch-Modus aus
- `npm run test:coverage` - Führt Tests mit Coverage aus

### Datenbank-Seed (Initialer Admin-User)

Der Seed-Script erstellt einen initialen Admin-User in der Datenbank:

```bash
npm run db:seed
```

**WICHTIG: Sie MÜSSEN diese Werte in der `.env`-Datei festlegen, bevor Sie den Seed ausführen!**

Die `.env`-Datei muss folgende Umgebungsvariablen enthalten:

```bash
SEED_ADMIN_EMAIL="CHANGE_ME_ADMIN_EMAIL"
SEED_ADMIN_PASSWORD="CHANGE_ME_STRONG_PASSWORD_MIN_8_CHARS"
SEED_ADMIN_NAME="Administrator"
```

**SICHERHEITSWARNUNG:**
- Verwenden Sie NIE die oben gezeigten Platzhalter!
- Ändern Sie diese Werte immer vor der ersten Verwendung!
- Verwenden Sie ein starkes Passwort (mindestens 8 Zeichen, besser 12+ Zeichen mit Sonderzeichen)
- Ändern Sie das Passwort nach dem ersten Login sofort!

### Weitere Datenbank-Skripte

- `npm run db:push` - Push Schema Changes direkt zur Datenbank (Entwicklung)
- `npm run db:studio` - Öffnet Prisma Studio zur Datenbank-Ansicht

## Datenbank-Setup

Die Datenbank wird initial mit dem gesquashten Skript `create_admin.sql` erstellt.
Schema-Aenderungen werden in der Entwicklung per `db:push` angewendet. Details siehe
[MIGRATIONS.md](./MIGRATIONS.md).

### Datenbank-Operationen in Produktion

Aus Sicherheitsgründen sind automatische Datenbank-Operationen (`db push` und `db seed`)
in der Produktion standardmäßig deaktiviert.

**WICHTIG:** In der Produktion werden folgende Umgebungsvariablen benötigt, um Datenbank-Operationen zu aktivieren:

- `ALLOW_DB_PUSH=true` - Aktiviert `prisma db push` (Schema-Änderungen)
- `ALLOW_DB_SEED=true` - Aktiviert `npm run db:seed` (Initialer Admin-User)

#### Empfohlener Migrations-Pfad für Produktion

1. **Schema-Änderungen:**
   ```bash
   # Auf dem Development-Server Änderungen an prisma/schema.prisma vornehmen
   npm run db:push

   # Schema-Änderungen testen
   npm run test

   # Für Produktion: Migrations-Skript erstellen oder manuell anwenden
   ```

2. **Produktion aktualisieren:**
   ```bash
   # Container stoppen
   docker-compose down

   # Datenbank sichern (BACKUP!)
   cp data/dev.db backup/dev.db.$(date +%Y%m%d-%H%M%S)

   # Nur wenn Schema-Änderungen erforderlich:
   docker-compose up -d
   docker-compose exec app sh -c "ALLOW_DB_PUSH=true npx prisma db push"

   # Für initiale Daten (nur beim ersten Setup):
   docker-compose exec app sh -c "ALLOW_DB_SEED=true npm run db:seed"

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

Docker Compose wird verwendet, um die SQLite-Datenbank in einem persistenten Volume zu betreiben.

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

Hinweis: Der Dockerfile nutzt BuildKit-Cache fuer npm. Falls BuildKit deaktiviert ist, bauen Sie so:

```bash
DOCKER_BUILDKIT=1 docker-compose up -d --build
```

### npm Cache auf dem Host teilen (schnellere Builds)

Standard: `.npm-cache` im Projektverzeichnis (wird in den Build-Kontext aufgenommen). Legen Sie das Verzeichnis einmal an und nutzen Sie es in Builds:

```bash
mkdir -p .npm-cache
DEPS_STAGE=deps-hostcache NPM_CACHE_DIR=.npm-cache DOCKER_BUILDKIT=1 docker-compose build app
```

Optional koennen Sie ein eigenes Cache-Verzeichnis verwenden (Docker muss Zugriff auf den Host-Pfad haben):

```bash
mkdir -p /pfad/zum/npm-cache
DEPS_STAGE=deps-hostcache NPM_CACHE_DIR=/pfad/zum/npm-cache DOCKER_BUILDKIT=1 docker-compose build app
```

### Volume persistenz

Die SQLite-Datenbankdatei wird im lokalen `./data`-Verzeichnis gespeichert, um Datenverluste bei Container-Neustarts zu vermeiden. Dies ermöglicht einfache Backups:

```bash
# Datenbank-Backup erstellen
cp data/dev.db backup/dev.db.$(date +%Y%m%d-%H%M%S)

# Datenbank wiederherstellen
cp backup/dev.db.YYYYMMDD-HHMMSS data/dev.db
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
npm test

# Tests im Watch-Modus
npm run test:watch

# Tests mit Coverage
npm run test:coverage
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
npm run lint

# Code formatieren
npm run format
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

# Anwendungseinstellungen
APP_NAME="RAG Schießsport MSE"
APP_URL="http://localhost:3000"
```

**WICHTIG:**
- Ersetzen Sie ALLE `CHANGE_ME_*`-Platzhalter mit Ihren eigenen Werten
- `NEXTAUTH_SECRET` muss mindestens 32 Zeichen lang sein und zufällig sein
- Verwenden Sie sichere SMTP-Passwörter
- In der Produktion: Alle Secrets müssen gesetzt werden, andernfalls startet die Anwendung nicht

## Features

### Authentifizierung

- E-Mail/Passwort-Login
- Session-Management
- Rollenbasierte Zugriffskontrolle (Admin vs. Mitglied)

### Termine

- Admins können Termine erstellen, bearbeiten und löschen
- Mitglieder können über Teilnahme abstimmen (Ja/Nein/Vielleicht)
- Eine Stimme pro Mitglied pro Termin

### News

- Admins können News-Artikel erstellen
- Öffentliche News-Liste und Detailseiten

### Kontaktformular

- Öffentliches Kontaktformular
- E-Mail-Versand an Administratoren
- Konfigurierbare Empfängerliste

### Datenschutz und Rechtliches

- Impressum (Inhalte durch Organisation bereitgestellt)
- Datenschutzerklärung (Inhalte durch Organisation bereitgestellt)
- Cookie-Banner (falls Cookies verwendet werden)

## Deployment auf VPS (geplant)

Die Anwendung wird hinter einem Reverse Proxy (z.B. HAProxy) auf einem VPS bereitgestellt.

> Hinweis: Deployment-Konfiguration ist noch nicht implementiert. Siehe TODO.md für den aktuellen Fortschritt.

### Produktions-Build erstellen

```bash
npm run build
```

### Produktionsserver starten

```bash
npm start
```

### Wichtige Produktions-Einstellungen

In der Produktion folgende Umgebungsvariablen anpassen:

```bash
NEXTAUTH_SECRET="CHANGE_ME_STRONG_SECRET_MIN_32_CHARS_PRODUCTION"
NEXTAUTH_URL="https://ihr-domain.de"
COOKIE_SECURE="true"
```

**WICHTIG:**
- `NEXTAUTH_SECRET` MUSS mit einem starken, zufälligen Wert gesetzt werden (mindestens 32 Zeichen)
- Verwenden Sie HTTPS in der Produktion
- Alle oben genannten Secrets sind PFLICHT für den Produktionsbetrieb

## Backup-Strategie (geplant)

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
