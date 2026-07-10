# Kontext / Glossar

Dieses Dokument ist ein Glossar der Fachbegriffe (Ubiquitous Language) dieses Projekts.
Es enthält bewusst **keine** Implementierungsdetails — nur die Bedeutung der Begriffe.

Die kanonische Fachsprache ist **Deutsch**. Der Code (Prisma-Modelle, Enums) ist
überwiegend englisch; wo ein deutscher Begriff einem englischen Modell entspricht, ist
das unter _Code:_ vermerkt. Unter _Vermeiden:_ stehen Synonyme, die wir bewusst **nicht**
verwenden, damit alle dasselbe Wort für dieselbe Sache benutzen.

## Akteure

Dieselbe Person wird aus zwei Blickwinkeln beschrieben: technisch als [[Benutzer]]
(Konto/Login) und fachlich als [[Mitglied]] (Vereinszugehörigkeit).

### Benutzer

Eine Person mit **Konto und Login** auf dieser Webseite — der technische Blickwinkel.
Jeder Benutzer hat genau eine [[Rolle]]. Konten werden ausschließlich von Administratoren
per [[Einladung]] angelegt; es gibt keine öffentliche Selbstregistrierung.

- _Code:_ Prisma-Modell `User`.
- _Vermeiden:_ „Account", „Nutzer" (nur „Benutzer").

### Mitglied

Eine Person, die dem Verein (RAG Schießsport MSE) angehört — der fachliche Blickwinkel
auf dieselbe Person, die technisch ein [[Benutzer]] ist. Ein Mitglied verwaltet seine
eigenen Stammdaten und kann an [[Termin]]en und [[Umfrage]]n teilnehmen.

- Nicht zu verwechseln mit der [[Rolle]] `MEMBER`: Diese trägt zwar dieselbe Bezeichnung
  „Mitglied", meint aber speziell ein **einfaches Mitglied ohne Verwaltungsrechte**. Ein
  Administrator ist ebenfalls ein Mitglied (Person), hat aber nicht die Rolle `MEMBER`.
- _Vermeiden:_ „Nutzer" für die Vereinsperson (das ist der [[Benutzer]]).

### Gast

Eine Person **ohne Benutzerkonto**, deren [[Teilnahmeanmeldung]] zu einem [[Termin]]
erfasst wird (Name + Ja/Nein/Vielleicht). Gäste loggen sich nicht ein.

- _Code:_ Prisma-Modell `GuestRegistration`.

### Rolle

Die Berechtigungsstufe eines [[Benutzer]]s. Genau eine pro Benutzer. Vier Stufen
(_Code:_ Enum `Role`):

- **Site-Administrator** (`SITE_ADMINISTRATOR`) — technische Vollverwaltung.
- **Administrator** (`ADMIN`) — verwaltet Konten, Termine, Umfragen, News, Dokumente,
  Ausschreibungen.
- **Prüfer** (`AUDITOR`) — **Lesezugriff** auf administrative Bereiche, ohne Änderungen
  vornehmen zu können.
- **Mitglied** (`MEMBER`) — einfaches Mitglied ohne Verwaltungsrechte (siehe Hinweis
  unter [[Mitglied]]).

### Login

Das **Einloggen** eines [[Benutzer]]s mit E-Mail und Passwort. „Login" bzw. „einloggen"
bezeichnet ausschließlich die Authentifizierung.

- _Vermeiden:_ „Anmeldung"/„anmelden" für das Einloggen — diese Wörter sind der
  [[Teilnahmeanmeldung]] zu einem Termin vorbehalten.

## Termine & Teilnahme

### Termin

Ein vom Administrator angelegtes Vereinsereignis auf dieser Webseite (Datum, Uhrzeit
von/bis, Ort, Kurzbeschreibung). Termine sind **öffentlich** einsehbar; die
[[Teilnahmeanmeldung]] und deren Ergebnisse sind nur für eingeloggte Benutzer sichtbar.

- _Code:_ Prisma-Modell `Event`.
- Abzugrenzen von der externen Veranstaltung einer [[Ausschreibung]]: Deren Wettbewerb
  ist **kein** Termin und hat keine Teilnahmeanmeldung auf dieser Seite.
- _Vermeiden:_ „Event", „Veranstaltung" (in der Fachsprache immer „Termin").

### Teilnahmeanmeldung

Die Rückmeldung eines [[Mitglied]]s oder [[Gast]]es zu einem [[Termin]] mit den Werten
**Ja / Nein / Vielleicht**. Genau eine pro Person und Termin; ein Mitglied kann seine
eigene Anmeldung sehen und zurückziehen. Das zugehörige Verb ist „sich anmelden".

- _Code:_ Prisma-Modell `Vote` (Enum `VoteType`: JA/NEIN/VIELLEICHT) für Mitglieder,
  `GuestRegistration` für Gäste.
- _Vermeiden:_ „Abstimmung", „Stimme", „voten" — diese Wörter gehören zur [[Umfrage]],
  nicht zum Termin.

## Umfragen

### Umfrage

Eine eigenständige Befragung mit frei definierten Antwortoptionen. Kann an einen
[[Termin]] gebunden sein (_Code:_ `PollType.TERMIN`) oder eigenständig stehen
(`PollType.SONSTIGES`). Durchläuft die Zustände Entwurf → Live → Geschlossen
(_Code:_ `PollStatus` DRAFT/LIVE/CLOSED). Nur eingeloggte Benutzer stimmen ab.

- _Code:_ Prisma-Modell `Poll` (Antwortoptionen: `PollOption`).
- Klar getrennt von der [[Teilnahmeanmeldung]]: Das Ja/Nein/Vielleicht eines Termins
  ist **keine** Umfrage.

### Stimme

Die Wahl einer oder mehrerer Antwortoptionen eines [[Benutzer]]s in einer [[Umfrage]].
Das zugehörige Verb ist „abstimmen". „Stimme"/„abstimmen" werden **ausschließlich** im
Umfrage-Kontext verwendet.

- _Code:_ Prisma-Modell `PollVote`.
- _Vermeiden:_ „Anmeldung"/„anmelden" (das ist die [[Teilnahmeanmeldung]] zum Termin).

## Dokumente

### Dokument

Eine intern bereitgestellte Datei im geschützten Bereich (Admin- oder
Mitgliederbereich). Abzugrenzen von der [[Ausschreibung]]: Dokumente sind **nicht**
öffentlich und haben **kein** [[Ablaufdatum]].

- _Code:_ Prisma-Modell `Document` (Bereich über `DocumentArea`: ADMIN oder MEMBER).

## Standorte

### Standort

Ein Schießstand bzw. Veranstaltungsort mit Adresse und Koordinaten, den Administratoren
pflegen und der zur Kartenanzeige eines [[Termin]]s dient.

- _Code:_ Prisma-Modell `ShootingRange`.
- _Vermeiden:_ „Schießstand", „Location" (in der Fachsprache „Standort").

## Einladungen

### Einladung

Ein zeitlich befristeter, tokenbasierter Zugang, über den ein Administrator eine neue
Person einlädt, ein [[Benutzer]]konto anzulegen. Ersetzt die (nicht existierende)
öffentliche Registrierung.

- _Code:_ Prisma-Modell `Invitation`.
- Abzugrenzen vom [[Login]] (bestehendes Konto) und von der [[Teilnahmeanmeldung]].
- _Vermeiden:_ „Registrierung".

## News

### News

Eine vom Administrator veröffentlichte Neuigkeit/Mitteilung auf der Webseite.

- _Code:_ Prisma-Modell `News`.
- _Vermeiden:_ „Neuigkeit", „Beitrag", „Artikel" (einheitlich „News").

## Ausschreibungen

### Ausschreibung

Eine öffentlich einsehbare Bekanntmachung eines externen Wettbewerbs oder einer
Veranstaltung (z. B. eine Landesmeisterschaft), zu der sich Mitglieder oder Gäste
**außerhalb dieser Webseite** anmelden. Die Webseite zeigt die Ausschreibung nur an
(typischerweise als PDF); sie wickelt die Anmeldung nicht ab.

- Für **alle Besucher** sichtbar, auch ohne Login.
- Wird von Administratoren verwaltet.
- Ist eine eigenständige Entität, technisch getrennt vom [[Dokument]].

- _Code:_ Prisma-Modell `Ausschreibung` (siehe `docs/adr/0001-…md`); Feld `expiresAt` für
  das [[Ablaufdatum]].

### Aktuelle Ausschreibung

Eine [[Ausschreibung]], deren [[Ablaufdatum]] noch nicht überschritten ist — sie gilt
**bis einschließlich** des Ablauftages als aktuell. Nur aktuelle Ausschreibungen
erscheinen im Vordergrund („aktuell").

### Historische Ausschreibung (abgelaufen)

Eine [[Ausschreibung]], deren [[Ablaufdatum]] überschritten ist — historisch also erst
**ab dem Tag nach** dem Ablaufdatum. Sie bleibt dauerhaft einsehbar (Historie/Archiv),
erscheint aber nicht mehr unter „aktuell".
Der Übergang aktuell → historisch geschieht automatisch anhand des Ablaufdatums,
ohne manuelle Aktion.

### Ablaufdatum

Das vom Administrator gesetzte „Anzeigen bis"-Datum einer [[Ausschreibung]]. Frei
wählbar; empfohlener Vorschlag ist das Veranstaltungsdatum. Eine Ausschreibung
gilt **bis einschließlich** dieses Tages als aktuell und erst **am Tag danach**
als historisch. Das Ablaufdatum bestimmt allein (rein rechnerisch, ohne
Statusfeld) die Zuordnung zu aktuell bzw. historisch.
