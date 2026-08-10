# Production Environment Checklist

This checklist helps ensure all necessary configuration changes are made when deploying the RAG MSE website to production.

## Pre-Deployment Checklist

### 1. Environment Variables

Copy `.env.example` to `.env` and update the following values:

#### Database
- [ ] `DATABASE_URL` - Ensure path points to production database file
  - Production example: `DATABASE_URL="file:/app/data/prod.db"`
- [ ] `APP_UID` and `APP_GID` are set explicitly and match the owner of `./data`
  - Example: `APP_UID="1000"` and `APP_GID="1000"`
  - Verify owner on host: `stat -c '%u:%g %n' ./data ./data/*.db`

#### Authentication
- [ ] `NEXTAUTH_SECRET` - **CRITICAL**: Generate a strong, random secret key (minimum 32 characters)
  - Generate with: `openssl rand -base64 32`
  - Example: `NEXTAUTH_SECRET="your-super-secret-key-minimum-32-chars-long"`
- [ ] `NEXTAUTH_URL` - Set to production HTTPS URL
  - Example: `NEXTAUTH_URL="https://www.rag-mse.de"`
- [ ] Do NOT use localhost or HTTP in production

#### Email Configuration (Contact Form)
- [ ] `SMTP_HOST` - Production SMTP server hostname
  - Example: `SMTP_HOST="smtp.gmx.com"`
- [ ] `SMTP_PORT` - SMTP server port (usually 587 for TLS, 465 for SSL)
  - Example: `SMTP_PORT="587"`
- [ ] `SMTP_USER` - SMTP username/email
  - Example: `SMTP_USER="info@rag-mse.de"`
- [ ] `SMTP_PASSWORD` - SMTP password (use app-specific password if using Gmail)
- [ ] `SMTP_FROM` - Sender email address
  - Example: `SMTP_FROM="noreply@rag-mse.de"`
- [ ] `ADMIN_EMAILS` - Comma-separated list of admin recipients for contact form
  - Example: `ADMIN_EMAILS="admin1@rag-mse.de,admin2@rag-mse.de"`

#### Application Settings
- [ ] `APP_NAME` - Application name
  - Example: `APP_NAME="RAG Schießsport MSE"`
- [ ] `APP_URL` - Production base URL
  - Example: `APP_URL="https://www.rag-mse.de"`
- [ ] `APP_TIMEZONE` - Zeitzone für datumsbasierte Reminder-Berechnung
  - Example: `APP_TIMEZONE="Europe/Berlin"`
- [ ] `TZ` - Container-Zeitzone; `Containerfile` und `compose.yaml` setzen standardmäßig
  `Europe/Berlin`, da die Termin-Datumslogik mit lokaler Zeit rechnet. Nicht entfernen.
- [ ] `NEXT_PUBLIC_SITE_URL` - Öffentliche Basis-URL für Metadaten/OpenGraph
  - Example: `NEXT_PUBLIC_SITE_URL="https://www.rag-mse.de"`

#### Reminder Configuration
- [ ] `EVENT_REMINDER_POLL_INTERVAL_MS` - Poll-Intervall des Reminder-Workers
  - Example: `EVENT_REMINDER_POLL_INTERVAL_MS="3600000"` (1 Stunde)
- [ ] `NOTIFICATION_TOKEN_VALIDITY_DAYS` - Token-Gültigkeit für `/anmeldung/[token]` und `/benachrichtigungen/abmelden/[token]`
  - Example: `NOTIFICATION_TOKEN_VALIDITY_DAYS="60"`

#### Cookie Settings
- [ ] `COOKIE_SECURE` - **CRITICAL**: Set to `"true"` when using HTTPS
  - Production: `COOKIE_SECURE="true"`
  - Development: `COOKIE_SECURE="false"`
- [ ] `COOKIE_MAX_AGE` - Session duration in seconds
  - Default: `"604800"` (7 days)

### 2. Initial Admin User

**IMPORTANT**: In production darf Seeding nur mit explizit gesetzten sicheren Werten erfolgen.

- [ ] Setzen Sie `ALLOW_DB_SEED="true"` nur für das initiale Setup
- [ ] Setzen Sie `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` und `SEED_ADMIN_NAME` explizit
- [ ] Prüfen Sie, dass keine Platzhalter- oder Standardwerte verwendet werden
- [ ] Starten Sie die Anwendung mit leerer Datenbank, damit das Seed automatisch läuft
- [ ] Login mit den explizit gesetzten Seed-Credentials prüfen
- [ ] **CRITICAL**: Change admin password immediately after first login
- [ ] Create additional admin accounts if needed

### 3. Database Setup

- [ ] Ensure database file is in persistent volume (rootless Podman bind mount ./data)
- [ ] Verify database directory has correct permissions
- [ ] Sicherstellen, dass `DATABASE_URL` auf die produktive SQLite-Datei zeigt, z. B. `file:/app/data/prod.db`
- [ ] Neue Datenbank durch `pnpm run db:migrate` bzw. den ersten Containerstart initialisieren
- [ ] Falls initialer Administrator angelegt werden soll: `ALLOW_DB_SEED=true` nur temporär setzen
- [ ] Test database connection

### 4. Security

- [ ] HTTPS is enabled via reverse proxy (HAProxy)
- [ ] SSL/TLS certificate is valid and not expired
- [ ] `NEXTAUTH_SECRET` is set to a strong, random value
- [ ] `COOKIE_SECURE` is set to `"true"`
- [ ] CSP unverändert lassen: Produktions-Policy erlaubt bewusst `script-src 'self' 'unsafe-inline'`, weil Next.js sonst die Client-Hydration blockiert
- [ ] CSP-Härtung prüfen: `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`
- [ ] Nach jeder CSP-Änderung Produktionsantwort prüfen: keine CSP-Fehler in der Browser-Konsole und Navigation/Menüs bleiben interaktiv
- [ ] SMTP credentials are secure (consider using app-specific passwords)
- [ ] Admin emails are verified and correct

### 5. Domain and DNS

- [ ] Domain is configured and pointing to server IP
- [ ] DNS propagation is complete
- [ ] HTTPS certificate is installed on reverse proxy
- [ ] Both `www` and non-`www` variants redirect correctly (if needed)

### 6. Podman Configuration

- [ ] `compose.yaml` is configured for production
- [ ] Build args and runtime user use the same IDs (`APP_UID` / `APP_GID`)
- [ ] Rootless `userns_mode: keep-id` keeps the host-owned `./data` bind mount writable
- [ ] App container runs with expected UID:GID
  - Verify in container: `podman-compose exec -T app id`
- [ ] Volume mounts are correct for data persistence
- [ ] Database backup strategy is in place
- [ ] Container restart policies are configured
- [ ] Resource limits are set (CPU, memory) if needed

### 7. Reverse Proxy (HAProxy)

- [ ] HAProxy is installed and running
- [ ] Configuration is tested: `sudo haproxy -c -f /etc/haproxy/haproxy.cfg`
- [ ] SSL certificate path is correct
- [ ] Backend server IP/Port matches Podman configuration (`127.0.0.1:3000`)
- [ ] X-Forwarded-* headers are properly set
- [ ] Stats endpoint is secured with strong password
- [ ] HAProxy logs are monitored

### 8. Application Build

- [ ] Production build is successful: `pnpm run build`
- [ ] All tests pass: `pnpm test`
- [ ] No linting errors: `pnpm run lint`
- [ ] Static assets are optimized
- [ ] Note: `deploy.sh` runs lint, typecheck (`tsc --noEmit`), and tests automatically as
  quality gates before building — a deploy aborts if any gate fails. Do not bypass or
  remove these gates.

### 9. Legal Pages

- [ ] Impressum page is updated with correct organization details
- [ ] Datenschutz page is reviewed and updated
- [ ] Cookie banner displays correctly (if cookies are used)
- [ ] Contact email addresses are correct

### 10. Monitoring and Logging

- [ ] Application logs are accessible: `podman-compose logs -f app`
- [ ] HAProxy logs are monitored: `sudo tail -f /var/log/haproxy.log`
- [ ] Database backups are scheduled
- [ ] Error notifications are configured (if needed)

### 11. Performance

- [ ] Page load times are acceptable
- [ ] Static assets are served efficiently
- [ ] Database queries are optimized
- [ ] CDN is configured (if needed)

### 12. Testing Checklist

Before going live, test the following user flows:

#### Authentication
- [ ] Login with correct credentials
- [ ] Login with incorrect credentials shows error
- [ ] Logout works correctly
- [ ] Session persists correctly

#### Admin Features
- [ ] Create new user account
- [ ] Create new event
- [ ] Edit existing event
- [ ] Delete event
- [ ] Create news post
- [ ] Edit news post
- [ ] Delete news post

#### Member Features
- [ ] View events list
- [ ] View event details
- [ ] Submit Teilnahmeanmeldung for an event (Ja/Nein/Vielleicht)
- [ ] Change Teilnahmeanmeldung
- [ ] View Teilnahmeanmeldung results
- [ ] Update notification settings (`/benachrichtigungen`)
- [ ] View news list
- [ ] View news detail
- [ ] Update profile information

#### Public Features
- [ ] Homepage loads correctly
- [ ] News list is accessible
- [ ] News detail page works
- [ ] Contact form submits correctly
- [ ] Impressum page is accessible
- [ ] Datenschutz page is accessible
- [ ] Links between pages work correctly

#### Email
- [ ] Contact form sends email to admin recipients
- [ ] Email content includes all form fields
- [ ] Email delivery is successful
- [ ] Reminder email for missing event RSVP is queued and delivered
- [ ] RSVP token link (`/anmeldung/[token]`) works
- [ ] Unsubscribe token link (`/benachrichtigungen/abmelden/[token]`) disables reminders

## Rate Limiting Considerations

### Geocoding Endpoint (`/api/geocode`)

The geocoding endpoint uses in-memory rate limiting (Map-based) which works correctly for single-instance deployments.

**For single-instance deployments:**
- Rate limiting works as expected
- Maximum of 10 requests per IP per minute
- In-memory state is maintained correctly

**For multi-instance deployments:**
- Each instance maintains its own rate limit state
- This may allow higher aggregate request rates than intended (e.g., 10 requests per minute per instance instead of 10 per minute total)
- If deploying multiple instances behind a load balancer, consider replacing the in-memory rate limiter with a distributed solution such as:
  - Redis-based rate limiting
  - Database-backed rate limiting store
  - Dedicated rate limiting service

**User-Agent Configuration:**
- The endpoint automatically constructs a proper Nominatim User-Agent header
- Format: `RAG-MSE-Website (APP_URL; first ADMIN_EMAIL)`
- Ensure `APP_URL` and `ADMIN_EMAILS` environment variables are set correctly
- Nominatim requires a User-Agent with contact information (email or URL)

**Nominatim API Usage:**
- Uses OpenStreetMap's Nominatim API (free, no API key required)
- Rate limiting is enforced client-side (10 requests/min/IP) to respect Nominatim's terms
- Nominatim may enforce additional server-side rate limits (typically 1 request/sec)
- For production with high geocoding needs, consider:
  - Caching geocoding results
  - Using a commercial geocoding API (Google Maps, Mapbox, etc.)

## Post-Deployment Checklist

### 0. Self-Test (Deployment-Verifikation)
- [ ] `SELFTEST_TOKEN` is set to a long random value (e.g. `openssl rand -hex 32`)
- [ ] Run the deep self-test and confirm HTTP **200** with `"status":"ok"`:
  - `curl -i -H "Authorization: Bearer $SELFTEST_TOKEN" https://<host>/api/selftest`
  - Investigate any `errors[]` (HTTP 503) before considering the deploy healthy; review `warnings[]` (HTTP 200)
- [ ] The self-test exercises DB + migrations, critical data, document storage, SMTP, workers, config and disk — read-only, no state change

### 1. Monitoring
- [ ] Set up uptime monitoring
- [ ] Configure error tracking (if needed)
- [ ] Monitor database size
- [ ] Monitor disk space

### 2. Backup Strategy
- [ ] Automated database backups are scheduled
  - Recommended: `beta-rag-db-backup.timer` from `ops/systemd/` is enabled and active
  - Manual run example: `./scripts/backup-sqlite.sh`
- [ ] Backup retention policy is defined
- [ ] Restore procedure is tested
- [ ] Offsite backup is configured (recommended)

### 3. Maintenance
- [ ] Update schedule is defined (security patches, dependency updates)
- [ ] SSL certificate auto-renewal is configured
  - Example: `0 3 * * * certbot renew --quiet && systemctl reload haproxy`
- [ ] Log rotation is configured
- [ ] Container updates are planned

### 4. Documentation
- [ ] Documentation is updated with deployment details
- [ ] Access credentials are securely stored
- [ ] Emergency contact information is documented
- [ ] Troubleshooting guide is available

## Environment-Specific Settings

### Development
```bash
DATABASE_URL="file:./data/prod.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-key"
COOKIE_SECURE="false"
SMTP_HOST="smtp.example.com"  # Test SMTP
```

### Production
```bash
DATABASE_URL="file:/app/data/prod.db"
NEXTAUTH_URL="https://www.rag-mse.de"
NEXTAUTH_SECRET="<32+ character random string>"
COOKIE_SECURE="true"
SMTP_HOST="your-production-smtp.com"
```

## Troubleshooting

### Common Issues

**Users cannot log in**
- Check `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are correct
- Verify `COOKIE_SECURE` matches your HTTPS setup
- Check database connection

**Contact form not sending emails**
- Verify SMTP credentials are correct
- Check SMTP host and port
- Verify firewall allows SMTP traffic (port 587 or 465)

**Database not persisting**
- Check Podman volume mounts
- Verify directory permissions
- Check database file path in `DATABASE_URL`

**HTTPS not working**
- Verify SSL certificate is valid
- Check HAProxy configuration
- Verify `COOKIE_SECURE="true"`

**HAProxy 502 Bad Gateway**
- Check Podman container is running: `podman-compose ps`
- Verify backend IP/Port in HAProxy config
- Check application logs: `podman-compose logs app`

## Deployment Rollback Procedure

### Verhalten bei fehlgeschlagenem Deployment (automatischer Rollback)

`deploy.sh` rollt bei einem fehlgeschlagenen Deployment automatisch zurück:

- **Fehlgeschlagener Image-Build oder Recreate:** Das Skript bricht ab; der zuvor laufende
  Container wird nicht angefasst. Die vorherigen `.next`-Build-Artefakte werden auf dem Host
  wiederhergestellt.
- **Neuer Container wird nie healthy** (z. B. fehlgeschlagene Migration in einer Crash-Loop):
  Das Skript stoppt den neuen Container, spielt das Pre-Deploy-Datenbank-Backup
  (`./data/backups/pre-deploy-*.db`) automatisch zurück (seit dem Backup gab es keine
  Benutzer-Schreibzugriffe), taggt das vorherige Image wieder als aktuelles Compose-Image und
  startet den Container mit dem alten Stand neu. Anschließend wird erneut auf `healthy`
  gewartet. Die vorherigen `.next`-Artefakte werden ebenfalls wiederhergestellt.
- **CSP-Smoke-Check schlägt fehl, nachdem der Container bereits healthy war:** Rollback nur
  auf das vorherige Image (`image-only`); die Datenbank bleibt unangetastet, da die App
  bereits Anfragen angenommen haben kann.
- Beim **ersten Deployment** (kein vorheriges Image vorhanden) bleibt der Container nach einem
  Fehlschlag gestoppt; das DB-Backup wird, sofern vorhanden, trotzdem zurückgespielt.

Schlägt auch der Rollback fehl, meldet das Skript `ROLLBACK FAILED` — dann ist manuelles
Eingreifen nach dem folgenden Ablauf nötig.

### Manueller Container-Rollback

Falls ein fehlerhaftes Image deployed wurde und der automatische Rollback nicht gegriffen hat:

1. Stoppe die laufenden Container:
   ```bash
   podman-compose down
   ```
2. Checkout des letzten funktionierenden Commits:
   ```bash
   git checkout <previous-commit-sha>
   ```
3. Deploy-Skript aus dem alten Stand ausführen (baut `.next` auf dem Host neu — das
   Containerfile kopiert die Host-Artefakte ins Image, ein reines `podman-compose build`
   würde die auf Platte liegenden Artefakte des fehlgeschlagenen Builds einpacken):
   ```bash
   ./deploy.sh
   ```
4. Prüfe, ob die Anwendung korrekt läuft:
   ```bash
   podman-compose ps
   podman-compose logs --tail=50 app
   ```

### Datenbank-Wiederherstellung

Automatische Backups werden täglich um 02:10 Uhr durch `ops/systemd/beta-rag-db-backup.timer` erstellt. Die Backup-Dateien liegen unter `/zfs/backups/beta-rag-mse/` (konfiguriert in `ops/systemd/beta-rag-db-backup.service`; das Skript-Default in `scripts/backup-sqlite.sh` zeigt auf dasselbe Verzeichnis). Neben der Datenbank (`prod.db.<datum>.sqlite3.gz`) sichert der Job auch die Upload-Verzeichnisse `data/documents` und `data/ausschreibungen` (`files.<datum>.tar.gz`).

Wiederherstellung aus einem Backup:

1. Container stoppen:
   ```bash
   podman-compose down
   ```
2. Datenbank-Backup entpacken und an den DB-Pfad kopieren:
   ```bash
   gunzip -k /zfs/backups/beta-rag-mse/prod.db.<datum>.sqlite3.gz
   cp /zfs/backups/beta-rag-mse/prod.db.<datum>.sqlite3 ./data/prod.db
   rm -f ./data/prod.db-wal ./data/prod.db-shm
   ```
3. Falls nötig, Dokument-Verzeichnisse wiederherstellen:
   ```bash
   tar -xzf /zfs/backups/beta-rag-mse/files.<datum>.tar.gz -C .
   ```
4. Container neu starten:
   ```bash
   podman-compose up -d
   ```

### Quick Recovery Steps (Notfall-Rollback)

1. `podman-compose down`
2. `git log --oneline -5` — letzten stabilen Commit identifizieren
3. `git checkout <stable-commit>`
4. Falls DB-Wiederherstellung nötig: Backup aus `/zfs/backups/beta-rag-mse/` entpacken und nach `./data/prod.db` kopieren
5. `./deploy.sh` — baut Host-Artefakte und Image aus dem alten Stand neu und startet den Container
6. `podman-compose ps` und `podman-compose logs --tail=50 app` — Zustand prüfen

## Additional Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)
- [Prisma Production Considerations](https://www.prisma.io/docs/guides/database/production-databases)
- [HAProxy Documentation](https://www.haproxy.org/#docs)
- [Let's Encrypt Certbot](https://certbot.eff.org/)
