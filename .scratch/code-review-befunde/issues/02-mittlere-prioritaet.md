# Code-Review-Befunde: Mittlere Priorität

Status: done

## What to build

Sammelticket für die Befunde mittlerer Schwere aus dem Gesamt-Review. Konfigurations-,
Konsistenz-, Korrektheits- und UX/A11y-Themen. Jeder Punkt ist einzeln umsetzbar und abnehmbar.

### Konfiguration & Deployment
1. **In Produktion still verworfene Env-Vars:** `compose.yaml` reicht `ALLOW_DB_SEED` nicht
   durch (dokumentiertes First-Run-Seeding funktioniert dadurch nicht), ebenso wenig
   `RATE_LIMIT_FAIL_OPEN` und `MAX_REQUEST_BODY_SIZE` (beide zur Laufzeit gelesen). Werte aus
   `.env` erreichen den Container nicht.
2. **Platzhalter-Secrets bestehen die Validierung:** `SELFTEST_TOKEN="CHANGE_ME_SELFTEST_TOKEN"`
   wird nur auf „nicht leer“ geprüft → ein unverändert kopiertes `.env` schaltet `/api/selftest`
   mit öffentlich bekanntem Token scharf. Auch der `NEXTAUTH_SECRET`-Platzhalter besteht (nur
   Länge ≥32 geprüft). Der vorhandene `hasPlaceholderPrefix`-Guard wird nur auf
   `SEED_ADMIN_PASSWORD` angewandt.

### Backend & Datenmodell
3. **Rate-Limit-Store ist ein modul-lokales Singleton** statt auf `globalThis`
   (`lib/rate-limit-store.ts:141`) — anders als alle anderen prozessweiten Singletons im Repo.
   `next dev`-HMR setzt Zähler mitten im Angriff zurück; in Prod würde ein dupliziertes
   Modul-Chunk den Per-IP-Zähler splitten.
4. **`PATCH /api/admin/polls/[id]` löscht Optionen außerhalb des Status-Guards** (`:46-61` prüft
   DRAFT in separater Query; `:76-85` löscht+erzeugt Optionen in einer Transaktion, die den
   Status nicht erneut prüft). Gleichzeitiges Publish+Edit kann Optionen und bereits abgegebene
   Stimmen einer LIVE-Umfrage löschen.
5. **`formatDate` (`lib/date-utils.ts:3-15`) liest das UTC-Kalenderdatum aus vollen Timestamps.**
   Korrekt für reine Datumsstrings, falsch für Instants: `createdAt`/`lastLoginAt` um 00:30
   Berliner Sommerzeit erscheinen einen Tag zu früh (`benutzerverwaltung/page.tsx:183`);
   `event-card.tsx:35` stimmt nur, solange der Server `TZ=UTC` läuft — was `compose.yaml` nicht
   setzt (nur `APP_TIMEZONE`). Ein einziger Berlin-bewusster Formatter behebt beides.

### Formulare & UX
6. **Umfrage-Formular-Modal ohne Schutz:** kein `ConfirmCloseModal`, kein
   `defaultData`/`initialData`, Escape/Outside-Click schließen — ein Klick verwirft eine fertig
   entworfene Umfrage still (`poll-form-modal.tsx`). Eine TERMIN-Umfrage ohne gewählten Termin
   tut beim Absenden nichts ohne Rückmeldung.
7. **Ausschreibung- und Benutzer-Modal schließen bei Escape mit offenem Datepicker** (react-
   datepickers Escape ruft kein stopPropagation) und verwerfen Änderungen; inkonsistent zu Event-/
   News-/Range-Modal, die `closeOnEscape`/`closeOnOutsideClick` auf `false` setzen.
8. **Ausschreibung-Anlage-Formular setzt das Datei-Input nicht zurück** nach erfolgreichem Upload
   (`admin-ausschreibung-manager.tsx:123` leert Textfelder, nicht das unkontrollierte File-Input) →
   die nächste Anlage zeigt einen veralteten Dateinamen, meldet aber „Datei ist erforderlich“.

### Barrierefreiheit
9. **Unsichtbarer Tab-Stopp im Rich-Text-Editor:** das `sr-only readOnly`-Textarea
   (`rich-text-editor.tsx:143`) ist fokussierbar und enthält Roh-HTML; braucht `tabIndex={-1}`
   (und `aria-hidden`).
10. **Doppelte `id="modal-title"`:** jedes Modal nutzt dieselbe ID; bei gestapelten Modals löst
    `aria-labelledby` des inneren Dialogs auf die Überschrift des äußeren auf.

### Dokumentation & Konsistenz
11. **Entfernte Seed-Standard-Credentials in drei Docs noch behauptet:** `prisma/seed.ts:49`
    überspringt das Admin-Seeding, wenn `SEED_ADMIN_*` fehlen — es gibt keinen
    `admin@rag-mse.de`-Fallback mehr, doch `README.md:75`, `QA_CHECKLIST.md:13` und
    `.env.example:108` dokumentieren ihn.
12. **`CONTEXT.md:167-177` widerspricht sich selbst und dem Code** an der Ablauf-Grenze der
    Ausschreibung (Text sagt „historisch am Ablauftag“, die „Ablaufdatum“-Definition, der ADR und
    `isAusschreibungCurrent` sagen „bis einschließlich aktuell“). Ein Maintainer könnte den Code an
    den falschen Glossar-Text angleichen.
13. **Backup-Zielverzeichnis widerspricht der Doku:** `scripts/backup-sqlite.sh:5` Default
    `/zfs/backup/rag-mse` vs. dokumentiert `/zfs/backups/beta-rag-mse` (Restore-Tag-Überraschung).
    Die Rollback-Prozedur in `PRODUCTION_CHECKLIST.md` baut aus dem schlechten `.next` auf Platte.
    Dokument-Verzeichnisse (`data/documents`, `data/ausschreibungen`) sind in keinem Backup-Job.

## Acceptance criteria

- [x] `ALLOW_DB_SEED`, `RATE_LIMIT_FAIL_OPEN`, `MAX_REQUEST_BODY_SIZE` werden vom Container empfangen; First-Run-Seeding funktioniert wie dokumentiert.
- [x] Platzhalter-Werte für `SELFTEST_TOKEN` und `NEXTAUTH_SECRET` schlagen die Konfig-Validierung fehl; Test deckt ab.
- [x] Rate-Limit-Store liegt auf `globalThis` (Muster wie prisma/Worker); Zähler überleben HMR.
- [x] `PATCH /polls/[id]` prüft den DRAFT-Status innerhalb der Transaktion, bevor Optionen ersetzt werden; Test für gleichzeitiges Publish+Edit.
- [x] Ein Berlin-bewusster Datumsformatter ersetzt die UTC-Extraktion für Instant-Werte; Anzeige stimmt unabhängig von der Server-TZ.
- [x] Umfrage-Modal hat Unsaved-Changes-Schutz und zeigt den Fehler bei fehlendem Termin sichtbar an.
- [x] Ausschreibung-/Benutzer-Modal schließen nicht mehr versehentlich bei Escape mit offenem Datepicker; Verhalten konsistent zu den anderen Modals.
- [x] Ausschreibung-Anlage-Formular setzt das Datei-Input nach Erfolg zurück.
- [x] Rich-Text-Editor-`sr-only`-Textarea ist nicht mehr fokussierbar; jedes Modal nutzt eine eindeutige Titel-ID.
- [x] Die drei Docs behaupten keine Seed-Standard-Credentials mehr; `CONTEXT.md`-Grenze ist widerspruchsfrei; Backup-Pfad und Rollback-Prozedur stimmen mit der Realität; Dokument-Verzeichnisse sind im Backup berücksichtigt (oder bewusst dokumentiert ausgeschlossen).
- [x] Voller Testlauf, Lint und `tsc --noEmit` bleiben grün.

## Blocked by

None - can start immediately

## Comments

**2026-07-09 (Agent):** Alle 13 Punkte umgesetzt:

1. `compose.yaml` reicht `ALLOW_DB_SEED`, `RATE_LIMIT_FAIL_OPEN` und `MAX_REQUEST_BODY_SIZE` durch.
2. Platzhalter-Werte für `NEXTAUTH_SECRET` und `SELFTEST_TOKEN` schlagen die Validierung fehl (CHANGE_ME/YOUR_-Präfix); Tests ergänzt.
3. Rate-Limit-Store liegt auf `globalThis` (Muster wie `lib/prisma.ts`).
4. `PATCH /api/admin/polls/[id]` prüft den DRAFT-Status innerhalb einer interaktiven Transaktion; Test für gleichzeitiges Publish+Edit (Optionen/Stimmen bleiben erhalten, 409).
5. `formatDate` zeigt für Instants das Berliner Kalenderdatum (Intl mit Europe/Berlin); reine Datumsstrings bleiben zeitzonenfrei; Tests für Sommer-/Winterzeit.
6. Umfrage-Modal: Unsaved-Changes-Schutz (`ConfirmCloseModal`), Escape/Outside-Click deaktiviert, fehlender Termin zeigt sichtbaren Fehler am Feld.
7. Benutzer- und Ausschreibung-Modal schließen nicht mehr bei Escape/Outside-Click (konsistent zu Event/News/Range).
8. Ausschreibung-Anlage-Formular setzt das File-Input nach Erfolg per Ref zurück.
9. `rich-text-editor`-sr-only-Textarea mit `tabIndex={-1}`/`aria-hidden`; Modal-Titel-IDs per `useId` eindeutig (Test für gestapelte Modals).
10. README/QA_CHECKLIST/.env.example behaupten keine Standard-Seed-Credentials mehr.
11. CONTEXT.md-Ablauf-Grenze widerspruchsfrei („bis einschließlich“ überall).
12./13. `backup-sqlite.sh`-Default auf `/zfs/backups/beta-rag-mse` (wie systemd-Service/Doku); Backup-Job sichert jetzt auch `data/documents` und `data/ausschreibungen` (mit Retention); Restore-Prozedur in PRODUCTION_CHECKLIST.md nennt die echten Dateinamen und die WAL-Bereinigung. (Rollback-Prozedur bereits mit Issue 01 korrigiert.)
