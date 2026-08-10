# Korrektheits-Befunde niedriger Schwere (Statuscodes, Rate-Limiter, E-Mail-Kanten)

Status: ready-for-agent

## What to build

Sammelticket aus dem Gesamt-Review 2026-07-30 (Befunde F28–F30, zurückgestellte Teile).
Datenintegrität ist in allen Fällen gewahrt — es geht um Statuscodes, Budget-Buchhaltung
und Randfälle.

### 500 statt 409/410 bei Check-then-Write-Races
1. `app/api/admin/users/[id]/route.ts` PATCH/E-Mail-Unique: P2002 → 409 mappen (POST
   macht es vor).
2. `app/api/admin/ranges/route.ts` + `[id]`: Namens-Unique-Race → 409.
3. `app/api/admin/documents/[id]/route.ts`: Verzeichnis zwischen Prüfung und Update
   gelöscht → P2003 → 404 (POST macht es vor).
4. `app/api/events/[id]/vote/route.ts` DELETE: find-then-delete, Doppelklick → P2025 →
   idempotent 200 oder 404 statt 500.
5. `app/api/polls/[id]/vote/route.ts`: paralleles deleteMany+createMany → P2002 → 409.
6. `lib/invitation-redemption.ts`: Einmal-Verbrauch als bedingtes `updateMany` (wie
   Passwort-Reset); Verlierer bekommt 410 statt 500.

### Rate-Limiter-Buchhaltung (`lib/rate-limiter.ts`)
7. `incrementIpAttempt` läuft vor der `blockedUntil`-Prüfung und wird nie zurückgerollt
   → geblockte Clients verbrennen das geteilte NAT-Budget (25/15 min).
8. Erfolgreicher Login dekrementiert den IP-Zähler doppelt (Aufruf aus
   `auth-config.ts:110` und `:191`).
9. `app/api/notifications/rsvp/[token]/route.ts`: erfolgreiche GETs setzen die Zähler
   zurück → Token-Inhaber kann darunter andere Tokens durchprobieren.
10. Formular-Validierungsfehler (Passwort-Policy) zählen auf den 4-Versuche-Token-Block
    von Reset-/Einladungslinks → No-JS-Nutzer sperren sich aus. Validierungsfehler nicht
    auf das Token-Budget anrechnen.

### E-Mail-/Token-Kanten
11. `outbox-worker.ts`: gelingt SMTP-Versand, aber das SENT-Update schlägt fehl, wird
    nach Lock-Ablauf erneut versendet (Doppelversand-Fenster). Mindestens: Fenster
    dokumentieren, ggf. Versand-Idempotenzmarke.
12. Manueller Retry setzt `firstQueuedAt`/`attemptCount` nicht zurück → transienter
    Fehler bei E-Mail älter 24h → sofort wieder FAILED.
13. Einladungs-Flows (`admin/invitations` create/resend/resend-by-email): E-Mail-Versand
    und Invalidierung älterer Einladungen nicht atomar; konkurrierende Einladungen
    können sich gegenseitig entwerten.
14. `app/api/notifications/rsvp/[token]` GET: fehlender Rollen-Guard, den POST hat —
    entzogene Vote-Berechtigung kann Termin+eigene Anmeldung bis 60 Tage weiter lesen.
15. Profil-E-Mail-Änderung (`app/api/user/profile`) ist unverifiziert und wird sofort
    Reset-Ziel; Session-E-Mail bleibt bis Re-Login alt. Entscheiden: Bestätigungs-Mail
    oder bewusst akzeptieren (dokumentieren).

### Kleinkram
16. `app/api/events/route.ts`: Pagination nur nach `date` sortiert → gleicher Tag kann
    über Seiten doppeln/fehlen; `id` als Tiebreaker.
17. `app/api/admin/news` + `polls`: getrimmte/ungeprüfte Werte (`" 2026-08-01 "`,
    `position` als String) → 500 statt 400.
18. `emails/templates/umfrage-benachrichtigung.txt`: hartes "RAG Schießsport MSE" statt
    `{{appName}}`.
