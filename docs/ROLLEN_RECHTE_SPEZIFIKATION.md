# Rollen- und Rechtespezifikation

Status: Verbindliche Ziel-Spezifikation (Stand: 2026-03-06)

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
| Termin-Abstimmung (Ja/Nein/Vielleicht) | Ja | Ja | Ja | Ja |
| Adminbereich betreten | Ja | Ja | Ja | Nein |
| Admin-Lesezugriff: Benutzerliste, Termine, News, Dokumente | Ja | Ja | Ja | Nein |
| Admin-Schreibzugriff: Benutzer, Termine, News, Dokumente | Ja | Ja | Nein | Nein |
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
- Darf Member-spezifische Funktionen ebenfalls nutzen (Profil/Passwort/Abstimmung).

## `MEMBER`

- Darf eigene Profildaten verwalten.
- Darf eigenes Passwort ändern.
- Darf an Termin-Abstimmungen teilnehmen.
- Kein Zugriff auf Adminbereich.

## Technische Leitplanken

- Alle sicherheitsrelevanten Berechtigungsentscheidungen müssen serverseitig in API-Routen und Server-Komponenten erfolgen.
- Clientseitige Checks dienen nur der UX und dürfen nie alleinige Sicherheitsbarriere sein.
- Mutierende Endpunkte (`POST`, `PUT`, `PATCH`, `DELETE`) müssen AuthN/AuthZ und CSRF-Schutz durchsetzen.
- Rollenänderungen und sicherheitsrelevante Aktionen müssen nachvollziehbar geloggt werden.

## Abgrenzung Auditor zu Admin (verbindlich)

- `AUDITOR` erhält Read-Only-Zugriff im Adminbereich.
- `AUDITOR` erhält **keinen** Zugriff auf ausgehende E-Mails.
- `AUDITOR` erhält **keinen** Zugriff auf Admin-Benachrichtigungen.
