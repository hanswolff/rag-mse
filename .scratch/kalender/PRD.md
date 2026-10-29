# Kalender mit Sichtbarkeitsstufen für Termine, Fremdterminen und Abwesenheiten

Status: done

## Problem Statement

Die Webseite kennt nur [[Termin]]e des Vereins, und die sind entweder öffentlich oder
ganz verborgen. Für die Terminplanung fehlen drei Dinge:

- **Interne Termine.** Ein Arbeitseinsatz oder ein Vorstandstreffen soll für Mitglieder
  sichtbar sein, aber nicht für jeden Besucher. Heute geht nur „öffentlich“ oder „nur im
  Adminbereich“.
- **Termine Dritter.** Geplante Reservistendienstleistungen (RDL), Veranstaltungen
  anderer Reservistenkameradschaften oder externe Wettkämpfe stehen nirgends. Wer einen
  RAG-Termin plant, merkt erst hinterher, dass am selben Wochenende eine RDL läuft.
- **Wer kann wann nicht.** Administratoren wissen nicht, wann Mitglieder im Urlaub oder
  anderweitig verhindert sind.

Außerdem gibt es keine Übersicht, in der man alle Einträge eines Monats auf einen Blick
sieht. Eine Liste wie `/termine` macht Überschneidungen nicht sichtbar.

## Solution

1. Der Termin bekommt die bei der [[Ausschreibung]] schon eingeführte
   **[[Sichtbarkeitsstufe]]**: *Öffentlich*, *Nur für Mitglieder* und *Verborgen*. Sie
   ersetzt das bisherige Ja/Nein-Feld „sichtbar“.
2. Administratoren pflegen **[[Fremdtermin]]e**. Ein Fremdtermin ist ein von Dritten
   ausgerichtetes Ereignis mit Zeitraum, optionaler [[Fremdtermin-Art]],
   Sichtbarkeitsstufe und optionalem Verweis auf eine [[Ausschreibung]].
3. Jeder eingeloggte Benutzer trägt eigene **[[Abwesenheit]]en** ein. Sie sind nur für
   ihn selbst, für Administratoren und für Prüfer sichtbar und werden 30 Tage nach
   ihrem Ende automatisch gelöscht.
4. Eine neue Seite **`/kalender`** zeigt Termine, Fremdtermine und Abwesenheiten
   zusammen (Monat, Woche, Liste). Jeder Betrachter sieht nur, was er sehen darf.
5. **[[Kollision]]en** fallen sofort auf. Ein Termin kollidiert, wenn ein anderer Eintrag
   denselben Kalendertag berührt. Administratoren und Prüfer sehen eine Markierung im
   Kalender, und das Termin-Formular zeigt einen Hinweis. Eine Kollision blockiert nichts.
6. Ein öffentliches **iCal-Abo** (`/kalender.ics`) enthält alle öffentlichen Einträge.

Release: Version **1.8.0** mit einer News zur neuen Funktion, die per Datenmigration
angelegt wird.

## User Stories

### Besucher (nicht eingeloggt)

1. Als Besucher möchte ich unter `/kalender` alle öffentlichen Termine und öffentlichen
   Fremdtermine eines Monats sehen, damit ich mir einen Überblick verschaffen kann.
2. Als Besucher möchte ich einen Link auf einen bestimmten Monat bzw. eine bestimmte
   Ansicht teilen können.
3. Als Besucher möchte ich den öffentlichen Kalender in meiner Kalender-App abonnieren
   (`/kalender.ics`).
4. Als Besucher, der einen Link auf einen Mitglieder-Termin öffnet, möchte ich zum Login
   geleitet und danach direkt zum Termin zurückgebracht werden.

### Mitglied

5. Als Mitglied möchte ich zusätzlich Termine und Fremdtermine mit der Sichtbarkeitsstufe
   „Nur für Mitglieder“ sehen, im Kalender und in `/termine`.
6. Als Mitglied möchte ich im Kalender eine Abwesenheit eintragen (von–bis, ganztägig
   oder mit Uhrzeit, optionaler Grund), bearbeiten und löschen.
7. Als Mitglied möchte ich nur meine eigenen Abwesenheiten sehen, nie die anderer.
8. Als Mitglied möchte ich Eintragsarten im Kalender ein- und ausblenden. Die Auswahl
   soll sich der Browser merken.
9. Als Mitglied möchte ich auf dem Handy eine lesbare Listenansicht bekommen.

### Administrator

10. Als Administrator möchte ich bei jedem Termin die Sichtbarkeitsstufe Öffentlich, Nur für
    Mitglieder oder Verborgen wählen.
11. Als Administrator möchte ich Fremdtermine unter `/admin/fremdtermine` anlegen,
    bearbeiten und löschen. Zusätzlich möchte ich sie direkt im Kalender schnell
    anlegen können.
12. Als Administrator möchte ich einen Fremdtermin optional mit einer Ausschreibung
    verknüpfen, damit das PDF im Kalender verlinkt ist.
13. Als Administrator möchte ich die Abwesenheiten aller Benutzer im Kalender sehen,
    pro Tag gesammelt („4 abwesend“) und aufklappbar mit Namen, Zeiten und Grund.
14. Als Administrator möchte ich Tage mit Kollisionen im Kalender markiert sehen.
15. Als Administrator möchte ich im Termin-Formular sofort einen Hinweis sehen, wenn der
    gewählte Tag mit anderen Terminen, Fremdterminen oder Abwesenheiten kollidiert. Der
    Hinweis soll mich nicht am Speichern hindern.

### Prüfer

16. Als Prüfer möchte ich alles sehen, was ein Administrator sieht (Fremdtermine im
    Adminbereich, Abwesenheiten, Kollisionen), ohne etwas ändern zu können.

## Implementation Decisions

### Sichtbarkeitsstufe (Termin)

- Das vorhandene Enum `AusschreibungVisibility { PUBLIC MEMBER HIDDEN }` (ADR 0011) wird
  zum gemeinsamen Enum **`Visibility`** umbenannt. SQLite speichert Enums als Text, daher
  ist für die Ausschreibung keine Datenmigration nötig. `Event.visibility` ersetzt
  `Event.visible`. Migration: `true` wird `PUBLIC`, `false` wird `HIDDEN`. Die Spalte
  `visible` entfällt. Standardwert für neue Termine ist `PUBLIC`.
- Abweichend von der Ausschreibung (dort 404 für alles Nicht-Öffentliche) führt ein
  anonymer Aufruf eines Termins „Nur für Mitglieder“ zum Login (Entscheidung Product
  Owner, 19.10.2026). Verborgene Termine antworten weiterhin mit 404.
- Lese-Regel, zentral in `buildVisibilityFilter`:
  - anonym: nur `PUBLIC`
  - eingeloggt: `PUBLIC` + `MEMBER` (+ eigene verborgene wie bisher)
  - Admin/Prüfer: alle
- Alle bisherigen Stellen mit `visible` werden umgestellt: öffentliche API,
  Detail-API, Teilnahmeanmeldung, RSVP-Token-Link, Erinnerungs-Worker, Sitemap,
  Metadaten, Startseite („nächster Termin“), Terminliste und Vergangenheit,
  Admin-Liste und Formular, Fixtures und Factories.
- Erinnerungen und Teilnahmeanmeldung gelten für `PUBLIC` und `MEMBER` (die
  Empfänger sind eingeloggte Benutzer). `HIDDEN` verhält sich wie bisher `visible=false`.
- Anonymer Zugriff auf einen `MEMBER`-Termin:
  - Die Detail-API antwortet mit **401** ohne Termindaten.
  - Die Detailseite leitet auf `/login?returnUrl=…` weiter.
  - Die Metadaten verraten nichts (`noindex`, generischer Titel).
  - Sitemap, iCal und öffentliche API enthalten diese Termine nicht.
- Umfragen geben einen gebundenen Termin nur heraus, wenn der Betrachter ihn sehen darf;
  sonst ist `event` leer.
- Bekannte, akzeptierte Konsequenz (wie ADR 0011): Anonyme Antworten werden öffentlich
  gecacht (`s-maxage=300`, `stale-while-revalidate=300`). Wird ein Termin herabgestuft,
  können geteilte Caches ihn bis zu ca. 10 Minuten weiter ausliefern.
- Im Formular wird die Checkbox „Termin sichtbar“ zu einem Auswahlfeld „Sichtbarkeitsstufe“.
  Die Admin-Liste zeigt ein Kennzeichen für „Nur für Mitglieder“ und „Verborgen“. Der Knopf
  „Veröffentlichen“ setzt auf `PUBLIC`.
- Beschriftungen und Farben der Sichtbarkeitsstufe stehen zentral an einer Stelle und
  werden von Ausschreibung, Termin und Fremdtermin gemeinsam genutzt (vorhandene
  Ausschreibungs-Beschriftungen wiederverwenden bzw. verallgemeinern).

### Fremdtermin

- Eigenes Modell `ExternalEvent` (siehe ADR 0011):
  - `title` (Pflicht)
  - `startDate`, `endDate` (Datum, Ende ≥ Start)
  - `allDay`; `timeFrom`/`timeTo` (`HH:MM`, nur ohne `allDay` und dann Pflicht; am
    selben Tag muss Ende > Start gelten)
  - `location`, `description`, `url` (alle optional; `url` nur http/https)
  - `kind` (optional, Enum `ExternalEventKind { RDL RK_EVENT COMPETITION OTHER }`,
    deutsche Beschriftungen zentral)
  - `visibility` (Enum `Visibility`, Standard `MEMBER`)
  - `ausschreibungId` (optional, FK, `onDelete: SetNull`)
  - `createdById` (FK, `SetNull`) und Zeitstempel
- Datumswerte werden wie beim Termin gespeichert (lokales Datum, `formatDateForStorage`).
- Admin-CRUD nach dem Standorte-Muster:
  - Seite `/admin/fremdtermine` mit Modal-Formular
  - Hook im Stil von `use-range-management`
  - API unter `/api/admin/fremdtermine` (GET mit `requireAdmin("read")`, Schreiben mit
    `requireAdmin("write")`)
  - zod-Schema, CSRF-Prüfung
  - Kachel im Admin-Dashboard
  - Prüfer lesen nur
- Die Liste zeigt kommende Fremdtermine zuerst. Vergangene bleiben erhalten (keine
  Löschfrist; sie enthalten keine personenbezogenen Daten).
- Das Ausschreibungs-Auswahlfeld bietet aktuelle und historische Ausschreibungen an.

### Abwesenheit

- Eigenes Modell `Absence`:
  - `userId` (FK, **`onDelete: Cascade`**)
  - `startDate`, `endDate`, `allDay`, `timeFrom`/`timeTo`: dieselben Regeln wie beim
    Fremdtermin, eine gemeinsame Validierung für dieses Zeitmodell
  - `reason` (optional, max. 200 Zeichen)
  - Zeitstempel
- API für eingeloggte Benutzer unter `/api/abwesenheiten`:
  - Anlegen, Ändern und Löschen nur für eigene Abwesenheiten, auch für Admins
  - Fremde Abwesenheit ändern: 404
  - Höchstens 100 laufende oder künftige Abwesenheiten (`endDate` ab heute) je Benutzer;
    darüber lehnt das Anlegen mit 400 und deutscher Meldung ab.
- Lesen anderer Abwesenheiten nur über die Kalender-API und nur für Admins und Prüfer.
  Herausgegeben werden nur Name (Vor- und Nachname), Zeitraum und Grund.
- Löschfrist: Der vorhandene Maintenance-Worker löscht Abwesenheiten, deren `endDate`
  mehr als 30 Tage zurückliegt (`ABSENCE_RETENTION_DAYS = 30`). Das Ergebnis wird
  mitgeloggt.
- Die Datenschutzerklärung bekommt einen Abschnitt zu Abwesenheiten (Zweck, Empfänger,
  Speicherdauer). Der Abschnitt „Speicherdauer“ wird ergänzt.

### Kalender-Sicht

- Neue öffentliche Seite **`/kalender`** und Menüpunkt „Kalender“ direkt nach
  „Termine“ in `NAV_ITEMS`. Die Seite steht auch in der Sitemap.
- **FullCalendar 6.1.22**, ausschließlich MIT-Pakete:
  - `@fullcalendar/react`, `core`, `daygrid`, `timegrid`, `list`, `interaction`
  - alle exakt auf 6.1.22 gepinnt; v7 hat keine passenden Plugins
  - deutsche Lokalisierung, Woche beginnt Montag
  - Styling über globale Theme-Tokens bzw. CSS-Variablen in `globals.css`, nicht lokal
- Ansichten: Monat, Woche, Liste.
  - Unter 768 px Breite ist die Liste der Standard.
  - Die URL hält Ansicht und Datum (`?ansicht=monat|woche|liste&datum=YYYY-MM-DD`) und
    ist damit teilbar.
  - Es gibt einen Knopf „Heute“.
- Eine Lese-API `GET /api/kalender?von=YYYY-MM-DD&bis=YYYY-MM-DD` (Zeitraum max.
  ca. 100 Tage) liefert je nach Betrachter:
  - Termine nach Sichtbarkeitsregel
  - Fremdtermine nach Sichtbarkeitsregel (gleiche Regel wie Termin; verborgene nur
    für Admins und Prüfer)
  - Abwesenheiten: für Mitglieder nur die eigenen, für Admins und Prüfer alle (mit Name)
  - Kollisionstage: nur für Admins und Prüfer
  - Anonyme Antworten dürfen gecacht werden, authentifizierte nicht.
  - Bekannte, akzeptierte Verzögerung (wie bei `/api/events`): Anonyme Antworten von
    `/api/kalender` und `/kalender.ics` tragen `max-age=60, s-maxage=300,
    stale-while-revalidate=300`. Änderungen an öffentlichen Einträgen (auch Herabstufen
    oder Löschen) erscheinen für Besucher und Kalender-Abos daher erst verzögert: im
    Normalfall nach ca. 6 Minuten (5 Minuten geteilter Cache plus 1 Minute Browser-Cache),
    im ungünstigsten Fall nach ca. 11 Minuten (`s-maxage` plus `stale-while-revalidate`
    plus Browser-Cache).
    Eingeloggte Benutzer sind nicht betroffen (`no-store`).
- Darstellung:
  - Eintragsarten mit eigenen Farben und einer Legende.
  - Bei Terminen ist die Terminart erkennbar, bei Fremdterminen die Art als Etikett.
  - Verborgene und Mitglieder-Einträge tragen für Berechtigte ein Kennzeichen.
  - Fremde Abwesenheiten erscheinen pro Tag als **ein Sammeleintrag** („4 abwesend“).
    Der Klick öffnet eine Liste mit Namen, Zeit und Grund. Eigene Abwesenheiten
    erscheinen einzeln.
- Klickverhalten:
  - Ein Termin führt zur Termin-Detailseite.
  - Fremdtermin, Abwesenheit und Sammeleintrag öffnen ein **Popover/Dialog**
    (barrierearm, Escape schließt).
  - Der Fremdtermin-Dialog verlinkt Ausschreibung und externen Link.
  - Der Dialog der eigenen Abwesenheit bietet Bearbeiten und Löschen.
- Filter: Schalter für Termine, Fremdtermine und Abwesenheiten (Letzterer nur für
  eingeloggte Benutzer). Die Auswahl liegt im `localStorage`, der Zugriff ist mit
  try/catch abgesichert.
- Bearbeiten im Kalender:
  - Eingeloggte Benutzer sehen den Knopf „Abwesenheit eintragen“. Die Auswahl eines
    Tages oder Zeitraums füllt das Formular vor.
  - Administratoren sehen zusätzlich „Fremdtermin eintragen“. Das ist dasselbe Formular
    wie im Adminbereich, als gemeinsame Komponente.
  - Prüfer sehen keine Schreibknöpfe für Fremdtermine.

### Kollision

- Reine, getestete Funktion in `lib/` (ohne DB-Zugriff). Eingabe sind Einträge mit
  Datumsbereichen, Ausgabe sind die Kollisionen je Termin bzw. je Tag.
- **Regel:** Ein Termin kollidiert mit jedem anderen Termin, Fremdtermin oder jeder
  Abwesenheit, die **denselben Kalendertag** berührt. Uhrzeiten spielen keine Rolle.
  Verborgene Termine und Fremdtermine zählen mit; nur Admins und Prüfer sehen das
  Ergebnis.
- Ein Tag ohne Termin ist keine Kollision, auch wenn sich Fremdtermine und
  Abwesenheiten überlagern.
- Im Kalender bekommen Kollisionstage eine Markierung (nur Admins und Prüfer).
  Die Markierung ist bewusst unabhängig von den Eintragsfiltern: Sie bleibt sichtbar,
  auch wenn z. B. Abwesenheiten ausgeblendet sind.
- Termin-Formular: `GET /api/admin/kollisionen?datum=YYYY-MM-DD[&ohneTermin=<id>]`
  (`requireAdmin("read")`) liefert die kollidierenden Einträge. Das Formular zeigt sie
  als `AlertBox type="warning"`, sobald ein Datum gewählt ist („Am … außerdem: RDL …,
  Training …, 4 Abwesenheiten“). Der Hinweis blockiert das Speichern nie.
  Bei Abwesenheiten nennt der Hinweis Anzahl und Namen der abwesenden Personen (ohne
  Grund) — das sehen ausschließlich Admins und Prüfer.
- Es werden keine E-Mails verschickt.

### iCal-Abo

- Route `/kalender.ics` (öffentlich, `text/calendar; charset=utf-8`, Cache-Header wie
  bei der öffentlichen API; akzeptierte Verzögerung von ca. 6, höchstens ca. 11 Minuten, siehe Kalender-Sicht).
- Inhalt:
  - nur `PUBLIC`-Termine und `PUBLIC`-Fremdtermine
  - von 90 Tagen in der Vergangenheit bis 1 Jahr in der Zukunft
  - Termine mit Zeit in `Europe/Berlin` (TZID samt VTIMEZONE oder UTC-Umrechnung)
  - ganztägige Fremdtermine als `VALUE=DATE` mit exklusivem `DTEND`
  - stabile UIDs
  - Zeilenfaltung nach RFC 5545
- `lib/calendar.ts` wird um einen Feed-Builder für mehrere Einträge erweitert. Das
  bestehende `buildCalendarEvent` bleibt unverändert.
- Der Kalender zeigt einen Link „Kalender abonnieren“ (inkl. `webcal://`-Variante).

### Release

- Version 1.8.0 in `package.json` und `lib/version-info.ts`.
- News per Datenmigration:
  - `INSERT OR IGNORE` mit fester ID
  - `published = 1`, `newsDate` = Release-Datum
  - Klartext-Inhalt (News werden als Text gerendert)
  - Der Text wird vor dem Commit vom Product Owner freigegeben.
- `TODO.md`, `README.md`, `AGENTS.md` (Kernseiten, Rollen) und `MIGRATIONS.md`
  (Historie) werden ergänzt.

## Testing Decisions

Tests prüfen äußeres Verhalten: API-Antworten je Rolle, Validierung, was eine Seite
zeigt.

- **Integration (echte SQLite)** ist die Hauptnaht für:
  - Sichtbarkeitsregeln: anonym, Mitglied, Prüfer, Admin × Termin und Fremdtermin
  - Abwesenheits-Rechte: eigene vs. fremde; ein Mitglied sieht nie fremde
  - Löschfrist
  - Kollisionsendpunkt
  - Migration (Backfill `visible` → `visibility`)
  - Kaskade beim Löschen eines Benutzers
- **Unit**:
  - Kollisionsfunktion (Tagesgrenzen, mehrtägige Einträge, Ganztag, eigener Termin
    ausgenommen)
  - Validierung des Zeitmodells
  - iCal-Feed (Escaping, Ganztag, Faltung)
  - Formular-Komponenten (Sichtbarkeitsauswahl, Kollisionshinweis)
  - Kalender-Seite (Filter, Popover, Rollen-abhängige Knöpfe), FullCalendar bei Bedarf
    gemockt
- `run-db-migrations.test.ts` muss grün bleiben (Schema = Migrationskette).
- Bestehende Tests mit `visible` werden umgestellt, nicht gelöscht.
- Coverage-Schwellen in `jest.config.ts` dürfen nicht sinken.
- Optional: ein Playwright-Pfad „Besucher öffnet Kalender und sieht öffentlichen Termin“.

## Out of Scope

- Mehrtägige oder ganztägige **Termine**: Der Termin bleibt ein Tag mit Uhrzeit.
- iCal-**Import** von Fremdkalendern; Fremdtermine werden manuell gepflegt.
- Persönliche, tokengeschützte iCal-Feeds für Mitglieder.
- E-Mails zu Fremdterminen, Abwesenheiten oder Kollisionen.
- Abwesenheiten für andere anlegen bzw. ändern durch Admins.
- Filter nach Terminart oder Fremdtermin-Art.
- Detailseiten für Fremdtermine.
- Anzeige von Kollisionen für Mitglieder oder Besucher.

## Further Notes

- ADR: `docs/adr/0013-fremdtermin-und-abwesenheit-als-eigene-modelle.md`.
- Glossar: Sichtbarkeitsstufe (verallgemeinert), Abwesenheit, Fremdtermin, Fremdtermin-Art, Kalender und
  Kollision sind bereits in `CONTEXT.md` aufgenommen.
- `lib/calendar.ts` (`buildCalendarEvent`) wird von `lib/notifications.ts` genutzt und
  bleibt kompatibel.
