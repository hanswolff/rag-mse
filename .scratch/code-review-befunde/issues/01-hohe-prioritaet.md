# Code-Review-Befunde: Hohe Priorität (Sicherheit & Datenintegrität)

Status: done

## What to build

Sammelticket für die Befunde mit hoher Schwere aus dem Gesamt-Review (Sicherheit,
Datenmodell, Backend, Deployment). Jeder Unterpunkt ist ein eigenständiger, verifizierter
Befund und kann einzeln behoben und abgenommen werden. Reihenfolge nach Risiko.

Hinweis: Punkt 5 (Deploy-/Rollback-Strategie) enthält eine Architekturentscheidung und
sollte vor der Umsetzung mit einem Menschen abgestimmt werden; die übrigen Punkte sind
AFK-umsetzbar.

### 1. Kontoübernahme über das ausgehende-E-Mail-Protokoll
`GET /api/admin/outgoing-emails` ist für jeden ADMIN lesbar und liefert `htmlBody`/`textBody`
jeder E-Mail (`app/api/admin/outgoing-emails/route.ts:65-80`). Passwort-Reset-Mails enthalten
den Roh-Token in der URL (`lib/password-reset.ts:19`). Ein einfacher Admin kann damit über
`POST /api/auth/forgot-password` einen Reset für das Site-Admin-Konto (oder ein beliebiges
Mitglied) auslösen, den Link aus dem Protokoll lesen und das Passwort setzen — das umgeht die
sonst sorgfältig durchgesetzte Rollentrennung.

### 2. Schema-Drift: `prisma migrate diff` ist nicht sauber
`schema.prisma` weicht von der real ausgerollten DB ab. Bestätigt: `User.name` ist in
`create_admin.sql:10,62` `NOT NULL`, in `schema.prisma:53` aber `String?`; der Index
`Invitation_email_usedAt_idx` (`schema.prisma:174`) existiert in keiner Migration. Weitere
Drifts laut Review: `News.newsDate`-Nullability, `Poll`-CHECK-Constraints/Defaults,
`hasPossessionCard`-Typ. Folge: Laufzeitfehler (`NOT NULL constraint failed`) und divergierende
Dev-/Prod-Schemata je nach Installationspfad.

### 3. Abgestürzte ausgehende E-Mails bleiben dauerhaft hängen
Der Outbox-Worker beansprucht nur `QUEUED`/`RETRYING`-Zeilen erneut
(`lib/email/outbox-worker.ts:44-57`). Eine Zeile im Status `PROCESSING`, deren Prozess stirbt
(z. B. OOM-Kill mitten im Versand), wird nie wieder beansprucht — die `lockedUntil <= now`-Klausel
ist wirkungslos, weil der Status-Filter `PROCESSING` ausschließt. Einladungs- oder Reset-Mails
gehen still verloren.

### 4. Migrations-Runner überspringt still Daten-Backfills
`scripts/run-db-migrations.ts:212-258` markiert eine Migration allein anhand der Schema-Statements
als „bereits angewandt“. Existiert eine Spalte bereits (z. B. durch ein `db push`), wird die
Migration ohne ihr `UPDATE`-Backfill als erledigt markiert — z. B. bliebe bei
`20260413_add_activated_at` `activatedAt = NULL`, und Forgot-Password meldet aktivierten
Mitgliedern fälschlich „Konto noch nicht aktiviert“.

### 5. `deploy.sh`: Rollback-Sicherung ist wirkungslos (Architekturentscheidung)
Das Backup von `.next` wird vom EXIT-Trap bedingungslos gelöscht, auch bei Fehlschlag, und nie
wiederhergestellt (`deploy.sh:80-87,165-172`) — ein fehlgeschlagener Build zerstört die vorigen
Artefakte. Eine fehlgeschlagene Migration lässt den neuen Container in einer Crash-Loop zurück,
ohne automatisches Rollback: das Pre-Deploy-DB-Backup wird nie zurückgespielt
(`deploy.sh:205`, `entrypoint.sh:33-37`). Der alte Container wird force-recreated, bevor der neue
gesund ist. `PRODUCTION_CHECKLIST.md:319` behauptet fälschlich, der Vorgänger bliebe laufen.

### 6. Stored XSS auf der öffentlichen News-Seite über JSON-LD
`app/news/[id]/page.tsx:32-60` setzt unsanitisierte `newsItem.title`/`newsItem.content` per
`JSON.stringify` in ein `<script type="application/ld+json">`. `JSON.stringify` escaped `</script>`
nicht; News-Inhalt wird beim Speichern nie HTML-sanitisiert (anders als Event-Beschreibungen).
Ein Autor mit `</script><script src=…>` führt JS im Browser jedes öffentlichen Besuchers aus.

### 7. `german-time-picker.tsx:48`: `key={value}` remountet bei jedem Tastendruck
react-datepicker feuert onChange pro parsebarem Tastendruck; der wechselnde `key` unmountet/
remountet den Picker, Fokus geht bei Tastatureingabe verloren. Zeitfelder sind faktisch nur per
Maus bedienbar — das untergräbt die A11y-Arbeit aus Commit 2c97b2f.

## Acceptance criteria

- [x] `outgoing-emails`: `htmlBody`/`textBody` nicht mehr an einfache Admins ausgeliefert (bzw. auf Site-Admin beschränkt / Reset-URLs redigiert); Regressionstest deckt ab, dass der Roh-Token nicht im Response erscheint.
- [x] `User.name`, `Invitation_email_usedAt_idx` und die weiteren gelisteten Drifts sind bereinigt; `prisma migrate diff` gegen die replayte Migrationskette ist leer; ein Test in `__tests__/run-db-migrations.test.ts` erzwingt dies dauerhaft.
- [x] `PROCESSING`-Zeilen mit abgelaufenem `lockedUntil` werden vom Outbox-Worker erneut beansprucht; Test simuliert einen Absturz und weist die Wiederaufnahme nach.
- [x] Der Migrations-Runner führt Daten-Backfills aus (oder bricht hart ab), wenn Schema-Statements bereits erfüllt sind; Test deckt den „Spalte existiert bereits“-Fall ab.
- [x] Deploy-/Rollback-Strategie mit Mensch abgestimmt und umgesetzt: fehlgeschlagener Build lässt vorige Artefakte intakt, fehlgeschlagene Migration führt zu definiertem, dokumentiertem Rollback; `PRODUCTION_CHECKLIST.md` beschreibt die Realität.
- [x] News-Inhalt wird beim Speichern sanitisiert; die JSON-LD-Ausgabe kann nicht aus dem `<script>`-Kontext ausbrechen; Test mit `</script>`-Payload.
- [x] `german-time-picker`: Tastatureingabe von Uhrzeiten funktioniert ohne Fokusverlust; das unnötige `key` ist entfernt.
- [x] Voller Testlauf (`pnpm test`), Lint und `tsc --noEmit` bleiben grün.

## Blocked by

None - can start immediately

## Comments

**2026-07-09 (Agent):** Alle sieben Punkte umgesetzt:

1. Reset-/Einladungs-/RSVP-/Abmelde-Token werden in `GET /api/admin/outgoing-emails` redigiert (`lib/email/redact.ts`); Regressionstest prüft, dass kein Roh-Token im Response erscheint.
2. Migration `20260709_fix_schema_drift` (User.name nullable, Poll-CHECKs/-Default entfernt, News.newsDate NOT NULL, Invitation-Composite-Index) plus `_AppMigration` als Modell in `schema.prisma`; Drift-Test replayt die Kette und erzwingt leeres `prisma migrate diff`. Dabei zusätzlich behoben: der Migrations-Runner deaktiviert jetzt Fremdschlüssel während Migrationen (sonst hätten Tabellen-Neubauten via ON DELETE CASCADE Kind-Zeilen gelöscht) und prüft danach `foreign_key_check`.
3. Outbox-Worker beansprucht PROCESSING-Zeilen mit abgelaufenem `lockedUntil` erneut; Test simuliert den Absturz.
4. Migrations-Runner führt Daten-Backfills auch dann aus, wenn Schema-Statements bereits erfüllt waren.
5. Rollback-Strategie (mit Mensch abgestimmt: voller Auto-Rollback): fehlgeschlagener Build stellt `.next` wieder her; wird der neue Container nicht healthy oder scheitert der CSP-Smoke-Check, wird das Pre-Deploy-DB-Backup zurückgespielt, das vorige Image re-taggt und neu gestartet. `PRODUCTION_CHECKLIST.md` beschreibt das reale Verhalten (inkl. Hinweis, dass `podman-compose build` die Host-`.next`-Artefakte einpackt).
6. JSON-LD wird über `serializeJsonLd` (`lib/json-ld.ts`) ausgegeben — `<`, `>`, `&`, U+2028/29 als Unicode-Escapes; gilt für News-, Termin- und Startseite. Test mit `</script>`-Payload. (News-Inhalt wird als Text gerendert, nicht als HTML — eine Speicher-Sanitisierung würde legitimen Text verfälschen; der Ausbruch aus dem Script-Kontext ist unterbunden.)
7. `key={value}` am Time-Picker entfernt; Test tippt eine Uhrzeit durch und prüft, dass der Fokus erhalten bleibt.
