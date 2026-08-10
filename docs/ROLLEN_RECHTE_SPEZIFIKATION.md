# Rollen- und Rechtespezifikation

Status: Verbindliche Ziel-Spezifikation (Stand: 2026-07-30)

Diese Spezifikation deckt alle aktuell implementierten Bereiche ab (inkl. Umfragen,
Ausschreibungen, Standorte, Mitglieder-Dokumente und Geocoding) und entspricht dem
Stand von `lib/permissions.ts`.

## Rollen

- `SITE_ADMINISTRATOR`
- `ADMIN`
- `AUDITOR` (Prüfer)
- `MEMBER`

## Grundprinzipien

- Authentifizierung erfolgt per E-Mail + Passwort.
- Autorisierung erfolgt serverseitig rollenbasiert.
- Least-Privilege gilt grundsätzlich, mit bewusstem Sonderfall für `AUDITOR`: weitgehender Lesezugriff im Adminbereich.
- Schreiboperationen im Adminbereich sind nur für `ADMIN` und `SITE_ADMINISTRATOR` erlaubt.
- Die Rolle `SITE_ADMINISTRATOR` ist systemintern und darf nicht regulär vergeben, herabgestuft oder gelöscht werden.

## Rechte-Matrix (Soll)

| Bereich/Funktion | SITE_ADMINISTRATOR | ADMIN | AUDITOR | MEMBER |
|---|---:|---:|---:|---:|
| Login | Ja | Ja | Ja | Ja |
| Öffentliche Seiten (Start, Termine, News, Kontakt, Rechtliches) | Ja | Ja | Ja | Ja |
| Profil verwalten (eigene Daten) | Ja | Ja | Ja | Ja |
| Passwort ändern (eigenes Konto) | Ja | Ja | Ja | Ja |
| Teilnahmeanmeldung zum Termin (Ja/Nein/Vielleicht) | Ja | Ja | Ja | Ja |
| Umfragen: Stimme abgeben (`canVotePolls`) | Ja | Ja | Ja | Ja |
| Mitglieder-Dokumente lesen (`canReadMemberDocuments`) | Ja | Ja | Ja | Ja |
| Adminbereich betreten | Ja | Ja | Ja | Nein |
| Admin-Lesezugriff: Benutzerliste, Termine, News, Dokumente | Ja | Ja | Ja | Nein |
| Admin-Schreibzugriff: Benutzer, Termine, News, Dokumente | Ja | Ja | Nein | Nein |
| Umfragen-Adminbereich lesen (`canReadPollsAdmin`) | Ja | Ja | Ja | Nein |
| Umfragen verwalten: anlegen, veröffentlichen, schließen, wieder öffnen, löschen (`canManagePolls`) | Ja | Ja | Nein | Nein |
| Ausschreibungen-Adminbereich lesen (`canReadAusschreibungenAdmin`) | Ja | Ja | Ja | Nein |
| Ausschreibungen verwalten: hochladen, bearbeiten, löschen (`canManageAusschreibungen`) | Ja | Ja | Nein | Nein |
| Standorte im Adminbereich lesen | Ja | Ja | Ja | Nein |
| Standorte verwalten | Ja | Ja | Nein | Nein |
| Mitglieder-Dokumente verwalten (`canManageMemberDocuments`) | Ja | Ja | Nein | Nein |
| Geocoding nutzen (`canUseGeocoding` = `canManageEvents`) | Ja | Ja | Nein | Nein |
| Ausgehende E-Mails einsehen | Ja | Ja | **Nein** | Nein |
| Admin-Benachrichtigungen einsehen | Ja | Ja | **Nein** | Nein |
| Einladungen verwalten/versenden | Ja | Ja | Nein | Nein |
| Benutzer impersonieren (Start/Stop) | Ja | Nein | Nein | Nein |

## Detaillierte Regeln

## `SITE_ADMINISTRATOR`

- Hat alle Rechte von `ADMIN`.
- Darf Impersonation starten und beenden.
- Darf `SITE_ADMINISTRATOR`-Konten bearbeiten (soweit systemseitig erlaubt).
- Rolle ist nicht regulär zuweisbar.

## `ADMIN`

- Vollständige operative Verwaltung (Benutzer, Termine, News, Dokumente, Einladungen).
- Kein Impersonation-Recht.
- Darf `SITE_ADMINISTRATOR` weder herabstufen noch löschen.

## `AUDITOR`

- Darf den Adminbereich betreten.
- Darf nahezu alles lesen, was `ADMIN` lesen kann.
- Darf keinerlei Admin-Schreiboperationen ausführen.
- Darf **nicht** auf folgende Bereiche zugreifen:
- Ausgehende E-Mails (`/admin/e-mail-versand`, entsprechende APIs)
- Admin-Benachrichtigungen (`/admin/benachrichtigungen`, entsprechende APIs)
- Darf Member-spezifische Funktionen ebenfalls nutzen (Profil/Passwort/Teilnahmeanmeldung/Umfrage-Stimme).

## `MEMBER`

- Darf eigene Profildaten verwalten.
- Darf eigenes Passwort ändern.
- Darf Teilnahmeanmeldungen zu Terminen abgeben, ändern und zurückziehen.
- Darf in Umfragen abstimmen und Mitglieder-Dokumente lesen.
- Kein Zugriff auf Adminbereich.

## Bereichsspezifische Regeln (Stand 2026-07-30)

### Umfragen

- `canReadPollsAdmin` (= Adminbereich lesen, inkl. `AUDITOR`): Lesezugriff auf den
  Umfragen-Adminbereich (`/admin/umfragen`, `GET /api/admin/polls`).
- `canManagePolls` (= `ADMIN`/`SITE_ADMINISTRATOR`): Umfragen anlegen, veröffentlichen
  (`publish`), schließen (`close`), wieder öffnen (`reopen`) und löschen.
- `canVotePolls` (= alle eingeloggten Rollen): Stimme in einer Umfrage abgeben
  (`/umfragen`, `POST /api/polls/[id]/vote`). „Stimme/abstimmen“ gilt ausschließlich
  für Umfragen, nicht für die Teilnahmeanmeldung zum Termin.
- Kurzlink `/u/<code>` leitet auf die jeweilige Umfrage weiter.

### Ausschreibungen

- Die öffentliche Seite `/ausschreibungen` ist ohne Login zugänglich.
- `canReadAusschreibungenAdmin` (= Adminbereich lesen, inkl. `AUDITOR`): Lesezugriff
  auf den Ausschreibungen-Adminbereich (`/admin/ausschreibungen`).
- `canManageAusschreibungen` (= `ADMIN`/`SITE_ADMINISTRATOR`): Ausschreibungs-PDFs
  hochladen, bearbeiten und löschen.

### Standorte

- Admin-Seite `/admin/standorte` mit API `/api/admin/ranges`.
- Lesen: alle Rollen mit Admin-Lesezugriff (inkl. `AUDITOR`).
- Anlegen, Bearbeiten, Löschen: nur `ADMIN`/`SITE_ADMINISTRATOR`.

### Mitglieder-Dokumente

- `canReadMemberDocuments` (= Mitgliederbereich): Auch `MEMBER` hat Lesezugriff auf
  den Mitglieder-Dokumentenbereich (`/mitglieder-dokumente`).
- `canManageMemberDocuments` (= `ADMIN`/`SITE_ADMINISTRATOR`): Verwaltung über
  `/admin/mitglied-dokumente`.

### Geocoding

- `canUseGeocoding` = `canManageEvents`: Die Geocoding-Funktion (`/api/geocode`,
  Adresssuche im Termin-/Standort-Formular) steht nur `ADMIN`/`SITE_ADMINISTRATOR`
  zur Verfügung.

## Technische Leitplanken

- Alle sicherheitsrelevanten Berechtigungsentscheidungen müssen serverseitig in API-Routen und Server-Komponenten erfolgen.
- Clientseitige Checks dienen nur der UX und dürfen nie alleinige Sicherheitsbarriere sein.
- Mutierende Endpunkte (`POST`, `PUT`, `PATCH`, `DELETE`) müssen AuthN/AuthZ und CSRF-Schutz durchsetzen.
- Rollenänderungen und sicherheitsrelevante Aktionen müssen nachvollziehbar geloggt werden.

## Abgrenzung Auditor zu Admin (verbindlich)

- `AUDITOR` erhält Read-Only-Zugriff im Adminbereich.
- `AUDITOR` erhält **keinen** Zugriff auf ausgehende E-Mails.
- `AUDITOR` erhält **keinen** Zugriff auf Admin-Benachrichtigungen.
