# Code-Review-Befunde: Niedrige Priorität (Low & Info)

Status: done

## What to build

Sammelticket für Befunde niedriger Schwere und Hinweise (Info) aus dem Gesamt-Review — Cleanup-
Pass. Einzeln umsetzbar; keine Sicherheits- oder Datenintegritätsrisiken, aber Konsistenz-,
Robustheits- und Wartbarkeitsverbesserungen.

### Fachsprache / Deutsch (Abgleich mit CONTEXT.md)
- „Schießstand“ statt des vorgeschriebenen „Standort“ (`range-form-modal.tsx`,
  `shooting-range-picker.tsx`, `app/admin/standorte/page.tsx`).
- „Abmelden“ für Logout bleibt im anmelden-Wortfeld, das CONTEXT.md für die Teilnahmeanmeldung
  reserviert („Ausloggen“ wäre konsistent, vgl. Commit 9996607).
- „Terminanmeldung“ statt kanonisch „Teilnahmeanmeldung“ (`app/anmeldung/[token]/page.tsx:114`).
- Gemischtes Du/Sie zwischen öffentlichen Termine-Seiten (du) und Kontakt/Login (Sie).
- Ein englisches `aria-label="Download"` (`document-table.tsx:192`, sollte „Herunterladen“).

### Robustheit / Korrektheit
- Roh-`err.message` fehlgeschlagener Fetches zeigt englische Browser-Strings in der deutschen UI
  (`use-admin-crud.ts:36` u. a.); `await response.json()` auf 204/HTML-Body wirft „Unexpected end
  of JSON input“.
- Kein Doppel-Submit-Schutz auf den Teilnahmeanmeldung-Buttons (`termine/[id]/page.tsx`);
  `use-event-management.ts` `fetchEvents` ohne Stale-Response-Guard bei schneller Paginierung;
  Delete-Handler nutzen den „create“-Loading-Setter.
- Datepicker committet Teileingaben (Tippen von „12.03.20“ speichert Jahr 0020).
- Reset-Password-Token-Consume ist nicht race-guarded (zwei Submissions gewinnen beide, last write
  wins) — anders als der Einladungs-Pfad, der es korrekt macht.
- bcrypt läuft innerhalb der offenen Schreibtransaktion (`invitation-redemption.ts:133`) und
  blockiert die einzelne SQLite-Verbindung ~100 ms.

### Datenmodell / Performance
- Redundanter `@@index([email])` auf Invitation (Präfix des Composite-Index).
- Nicht indizierte Cascade-FK-Spalten (`PollVote.optionId`, `PollNotificationDispatch.userId`).
- `Event.timeFrom/timeTo` sind Freitext-Strings mit stillem 00:00-Fallback bei Fehlparsen.
- WAL/Busy-Timeout hängen an Seiteneffekten (Migrations-Runner setzt WAL), nicht an expliziten
  Pragmas in `lib/prisma.ts` — eine per `db push` erzeugte Dev-DB bekommt nie WAL.

### Ausschreibungen / sonstiges
- Gleichzeitiger PDF-Austausch verwaist eine Datei ohne Log; der öffentliche
  `GET /api/ausschreibungen`-Endpunkt hat keinen Konsumenten und dupliziert die
  Aufteilungs-/Sortierlogik der Seite (Drift-Risiko).
- Unbeschränktes Wachstum: Pre-Deploy-Backups, `OutgoingEmail`-Attachment-Blobs (base64 inline,
  nie bereinigt), verbrauchte Token-Zeilen.
- Deprecated `X-XSS-Protection`-Header per Test zementiert (`haproxy.cfg.example`); Logrotate-Glob
  (`*.log`) matcht die vom App geschriebenen `.eml`-Dateien nicht.
- ADR-0002 („Code bleibt englisch“) wird durch das deutsche `model Ausschreibung` stillschweigend
  widersprochen — im ADR als bewusste Ausnahme vermerken.
- Rich-Text-Editor-Ausgabe auf öffentlichen Seiten ohne `overflow-wrap`/`word-break` → eine
  eingefügte lange URL läuft auf Mobil über den Kartenrand hinaus.

### Tooling
- pnpm warnt, dass `pnpm.overrides`/`pnpm.onlyBuiltDependencies` in `package.json` von der
  aktuellen pnpm-Version nicht mehr gelesen werden — diese Overrides werden still nicht angewandt;
  in die neue Konfig-Position verschieben.

## Acceptance criteria

- [x] Fachbegriffe an CONTEXT.md angeglichen (Standort statt Schießstand, Ausloggen, Teilnahmeanmeldung); Du/Sie auf öffentlichen Seiten einheitlich; englische aria-labels übersetzt.
- [x] Fetch-Fehler zeigen deutsche Meldungen; `response.json()` behandelt leere/Nicht-JSON-Bodies robust.
- [x] Doppel-Submit-Schutz auf Teilnahmeanmeldung-Buttons; `fetchEvents` mit Stale-Response-Guard; Delete-Handler nutzen einen eigenen Loading-Zustand.
- [x] Datepicker akzeptiert keine unplausiblen Teiljahre mehr; Reset-Token-Consume ist race-guarded; bcrypt läuft vor der Transaktion.
- [x] Redundanter Invitation-Index entfernt; Cascade-FK-Spalten indiziert; explizite WAL-/busy_timeout-Pragmas in `lib/prisma.ts`.
- [x] Ausschreibung-PDF-Austausch/Löschung ohne verwaiste Dateien (oder mit Log); duplizierte Aufteilungs-/Sortierlogik konsolidiert; Aufbewahrungsgrenzen für Backups/OutgoingEmail/Token.
- [x] Logrotate matcht die tatsächlichen Log-Dateien; ADR-0002-Ausnahme dokumentiert; öffentliche Rich-Text-Ausgabe bricht lange URLs um.
- [x] pnpm-Overrides in die neue Konfig-Position verschoben; keine pnpm-Warnung mehr.
- [x] Voller Testlauf, Lint und `tsc --noEmit` bleiben grün.

## Blocked by

None - can start immediately

## Comments

Alle Punkte umgesetzt (2026-07-09):

**Fachsprache / Deutsch**
- Schießstand→Standort in `range-form-modal`, `shooting-range-picker`, `app/admin/standorte`,
  Ranges-APIs und `use-range-management` (Beispiel-Platzhalter „z.B. Schießstand Neubrandenburg“
  bleibt als Eigenname; `app/info/schiesssportordnung` betrifft physische Schießstände und bleibt).
- Abmelden→Ausloggen (`user-menu`), Terminanmeldung→Teilnahmeanmeldung
  (`app/anmeldung/[token]`, `app/benachrichtigungen`), aria-label Download→Herunterladen.
- Du/Sie: Sie-Form ist projektweit dominant (Login, Kontakt, Passwort-Formulare, übrige
  E-Mail-Templates) — alle du-Formen auf Termine-/Anmeldungs-/Benachrichtigungs-/Umfragen-Seiten
  sowie in `termin-erinnerung.txt` und `umfrage-benachrichtigung.txt` (inkl. Admin-Vorschau)
  auf Sie umgestellt.

**Robustheit / Korrektheit**
- `use-admin-crud`: `parseJsonBody()` toleriert leere/Nicht-JSON-Bodies; `toDisplayErrorMessage()`
  mappt fetch-`TypeError` auf deutsche Netzwerkfehlermeldung (App-eigene deutsche Meldungen
  werden weiter durchgereicht); Tests ergänzt.
- Doppel-Submit-Schutz: Vote-Buttons disabled während `isVoting`; `use-event-voting` mit
  synchronem `isVotingRef`-Guard (State-Update greift erst beim Re-Render).
- `use-event-management.fetchEvents` mit Stale-Response-Guard (Request-Id); eigene
  Delete-Loading-States (`isDeletingEvent/User/News`) statt des create-Setters.
- Datepicker: `handleDateChange` committet keine unplausiblen Jahre (<1900/>2100) mehr —
  react-datepicker parst Teileingaben („12.03.20“ → Jahr 0020) schon beim Tippen; Test ergänzt.
- Reset-Password-Consume race-guarded: atomisches `updateMany({ usedAt: null })` in der
  Transaktion, zweite Submission erhält 410; Test ergänzt.
- bcrypt läuft jetzt vor der Transaktion (`hashRedemptionPassword()` im Invitation-Route-Handler,
  `redeemInvitationInTransaction` erhält den fertigen Hash).

**Datenmodell / Performance**
- Migration `20260709_adjust_indexes`: redundanter `Invitation_email_idx` entfernt,
  `PollVote_optionId_idx` und `PollNotificationDispatch_userId_idx` ergänzt (Schema synchron,
  Drift-Test grün).
- `lib/prisma.ts`: expliziter better-sqlite3 `timeout: 10_000` (busy_timeout) und einmaliges
  `PRAGMA journal_mode = WAL` pro Prozess (persistiert in der DB-Datei).
- `Event.timeFrom/timeTo` als Freitext-Strings: bewusst nicht angefasst (nur Beobachtung,
  kein Akzeptanzkriterium; Format wird bei Eingabe validiert).

**Ausschreibungen / sonstiges**
- Gleichzeitiger PDF-Austausch: `storedFileName` wird in der Update-Transaktion neu gelesen,
  die tatsächlich ersetzte Datei gelöscht und der Konflikt geloggt
  (`ausschreibung_concurrent_file_replace`).
- Aufteilungs-/Sortierlogik in `splitAndSortAusschreibungen()` konsolidiert (Seite + API nutzen
  dieselbe Funktion; der öffentliche Endpunkt bleibt, driftet aber nicht mehr).
- Aufbewahrungsgrenzen: neuer `lib/maintenance-worker.ts` (12-h-Intervall, via instrumentation
  gestartet) leert Attachment-Blobs terminaler `OutgoingEmail`-Zeilen nach 30 Tagen und löscht
  verbrauchte/abgelaufene `PasswordReset`- (30 d), `Invitation`- (90 d) und
  `EventReminderDispatch`-Zeilen (nur wenn beide Token abgelaufen — Dedupe bleibt intakt);
  deploy.sh behält nur noch die letzten 10 Pre-Deploy-Backups.
- `haproxy.cfg.example`: deprecated `X-XSS-Protection` entfernt, Test zementiert jetzt die
  Abwesenheit; `ops/logrotate`: Hinweis + Cron-Beispiel für altersbasierte `.eml`-Bereinigung
  (Rotation passt nicht für Eine-Datei-pro-E-Mail).
- ADR-0002: `model Ausschreibung` als bewusste Ausnahme dokumentiert (kein Präzedenzfall).
- `globals.css`: `overflow-wrap: anywhere` für `.event-description-content`/`.tiptap-content` —
  lange URLs brechen auf Mobil um.

**Tooling**
- pnpm-Overrides/onlyBuiltDependencies nach `pnpm-workspace.yaml` verschoben. Befund dabei:
  pnpm 10.0.0 las weder `package.json` noch `pnpm-workspace.yaml`-Overrides (Unterstützung kam
  erst in späteren 10.x) — die Pins waren seit dem pnpm-10-Upgrade still inaktiv. pnpm auf
  10.34.3 aktualisiert (`packageManager`-Feld angehoben), Lockfile enthält die Overrides wieder
  (z. B. jsdom 28.0.0 wirksam), keine pnpm-Warnung mehr.
