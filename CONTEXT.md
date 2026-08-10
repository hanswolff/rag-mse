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
- _Vermeiden:_ „Account“, „Nutzer“ (nur „Benutzer“).

### Mitglied

Eine Person, die dem Verein (RAG Schießsport MSE) angehört — der fachliche Blickwinkel
auf dieselbe Person, die technisch ein [[Benutzer]] ist. Ein Mitglied verwaltet seine
eigenen Stammdaten und kann an [[Termin]]en und [[Umfrage]]n teilnehmen.

- Nicht zu verwechseln mit der [[Rolle]] `MEMBER`: Diese trägt zwar dieselbe Bezeichnung
  „Mitglied“, meint aber speziell ein **einfaches Mitglied ohne Verwaltungsrechte**. Ein
  Administrator ist ebenfalls ein Mitglied (Person), hat aber nicht die Rolle `MEMBER`.
- _Vermeiden:_ „Nutzer“ für die Vereinsperson (das ist der [[Benutzer]]).

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
  vornehmen zu können. Ausgenommen sind der [[Postausgang]] und die
  Benachrichtigungs-Übersicht (nur Administratoren).
- **Mitglied** (`MEMBER`) — einfaches Mitglied ohne Verwaltungsrechte (siehe Hinweis
  unter [[Mitglied]]).

### Login

Das **Einloggen** eines [[Benutzer]]s mit E-Mail und Passwort. „Login“ bzw. „einloggen“
bezeichnet ausschließlich die Authentifizierung.

- _Vermeiden:_ „Anmeldung“/„anmelden“ für das Einloggen — diese Wörter sind der
  [[Teilnahmeanmeldung]] zu einem Termin vorbehalten.

## Termine & Teilnahme

### Termin

Ein vom Administrator angelegtes Vereinsereignis auf dieser Webseite (Datum, Uhrzeit
von/bis, Ort, Kurzbeschreibung). Sichtbare Termine sind **öffentlich** einsehbar; die
[[Teilnahmeanmeldung]] und deren Ergebnisse sind nur für eingeloggte Benutzer sichtbar.

- Ein Termin kann vom Administrator **ausgeblendet** werden (_Code:_ Feld `visible`):
  Ein ausgeblendeter Termin erscheint weder öffentlich noch für Mitglieder — nur im
  Adminbereich.
- Jeder Termin hat eine [[Terminart]].
- _Code:_ Prisma-Modell `Event`.
- Abzugrenzen von der externen Veranstaltung einer [[Ausschreibung]]: Deren Wettbewerb
  ist **kein** Termin und hat keine Teilnahmeanmeldung auf dieser Seite.
- _Vermeiden:_ „Event“, „Veranstaltung“ (in der Fachsprache immer „Termin“).

### Terminart

Die Einordnung eines [[Termin]]s als **Training**, **Wettkampf** oder **Lehrgang**.
Die Terminart ist optional; ein Termin ohne Einordnung bleibt zulässig.

- **Training:** der regelmäßige eigene Übungsbetrieb **ohne externe Anleitung**.
- **Wettkampf:** ein Termin mit Wertung.
- **Lehrgang:** die angeleitete Vermittlung von Wissen oder Können, typischerweise mit
  gebuchtem Referenten, Kosten und begrenzter Teilnehmerzahl. Umgangssprachlich auch
  „Kurs“; kanonisch ist **Lehrgang**.
- Abzugrenzen von der [[Ausschreibung]]: Beim Lehrgang bucht der Verein und die
  [[Teilnahmeanmeldung]] läuft über diese Webseite. Richtet ein Dritter aus und erfolgt
  die Anmeldung außerhalb dieser Webseite, ist es eine Ausschreibung.
- _Code:_ Feld `Event.type` (nullbarer Freitext mit deutschen Werten,
  zentral in `lib/event-types.ts`).

### Titel

Die optionale Überschrift eines [[Termin]]s („Dynamisches Pistolenschießen Level 1“).
Ohne Titel bleibt das Datum die Überschrift; der Titel ersetzt Datum, Uhrzeit und Ort
nirgends, sondern tritt daneben.

- _Code:_ Feld `Event.title`.

### Kosten

Die optionale Angabe, was die Teilnahme an einem [[Termin]] kostet — ein **kurzer
Freitext**, kein Betrag („25 € für Mitglieder, 40 € für Gäste“, „kostenfrei“). Damit
sind Staffelungen nach [[Mitglied]] und [[Gast]] abbildbar. Über die Kosten wird nirgends
gerechnet oder sortiert.

- _Code:_ Feld `Event.cost`.

### Plätze

Die optionale Zahl der Teilnahmeplätze eines [[Termin]]s. Sie ist eine **Information,
keine Sperre**: Sie verhindert keine [[Teilnahmeanmeldung]], erzeugt keine Warteliste
und lässt niemanden nachrücken. Bei Überbuchung erscheint lediglich ein Hinweis im
Adminbereich.

- _Code:_ Feld `Event.capacity`; Begründung in
  `docs/adr/0003-platzzahl-ist-informativ-und-sperrt-keine-anmeldung.md`.
- _Vermeiden:_ „Kapazitätsgrenze“, „maximale Teilnehmerzahl“ — beides suggeriert eine
  Sperre, die es nicht gibt.

### Belegung

Wie viele der [[Plätze]] eines [[Termin]]s durch Ja-[[Teilnahmeanmeldung]]en vergeben
sind („7 von 12 Plätzen belegt (+3 vielleicht)“). Ja-Anmeldungen von [[Mitglied]]ern und
[[Gast]]en zählen gleichermaßen; „Vielleicht“ belegt keinen Platz, wird aber als Zusatz
ausgewiesen.

- Die Belegung wird **berechnet, nicht gespeichert** — es gibt kein Zählerfeld.
- Sie ist ein Ergebnis der Teilnahmeanmeldung und damit **nur für eingeloggte Benutzer**
  sichtbar; die öffentliche Termin-API liefert sie nicht mit.
- Sie sperrt nichts (siehe [[Plätze]]).

### Teilnahmeanmeldung

Die Rückmeldung eines [[Mitglied]]s oder [[Gast]]es zu einem [[Termin]] mit den Werten
**Ja / Nein / Vielleicht**. Genau eine pro Person und Termin; ein Mitglied kann seine
eigene Anmeldung sehen und zurückziehen. Das zugehörige Verb ist „sich anmelden“.

- _Code:_ Prisma-Modell `Vote` (Enum `VoteType`: JA/NEIN/VIELLEICHT) für Mitglieder,
  `GuestRegistration` für Gäste.
- _Vermeiden:_ „Abstimmung“, „Stimme“, „voten“ — diese Wörter gehören zur [[Umfrage]],
  nicht zum Termin.

### Termin-Erinnerung

Eine automatische E-Mail an [[Benutzer]] vor einem [[Termin]] (Vorlaufzeit je Benutzer
einstellbar). Sie enthält einen tokenbasierten Link, über den der Empfänger seine
[[Teilnahmeanmeldung]] ohne [[Login]] abgeben oder ändern kann. Jeder Benutzer erhält
pro Termin höchstens eine Erinnerung.

- _Code:_ Prisma-Modell `EventReminderDispatch`; Benutzer-Einstellungen
  `eventReminderEnabled` / `eventReminderDaysBefore`.
- Die Erinnerung zu einer [[Umfrage]] heißt **Umfrage-Benachrichtigung**
  (_Code:_ `PollNotificationDispatch`, Einstellung `pollNotificationEnabled`).

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
Das zugehörige Verb ist „abstimmen“. „Stimme“/„abstimmen“ werden **ausschließlich** im
Umfrage-Kontext verwendet.

- _Code:_ Prisma-Modell `PollVote`.
- _Vermeiden:_ „Anmeldung“/„anmelden“ (das ist die [[Teilnahmeanmeldung]] zum Termin).

## Dokumente

### Dokument

Eine intern bereitgestellte Datei im geschützten Bereich (Admin- oder
Mitgliederbereich). Abzugrenzen von der [[Ausschreibung]]: Dokumente sind **nicht**
öffentlich und haben **kein** [[Ablaufdatum]].

- _Code:_ Prisma-Modell `Document` (Bereich über `DocumentArea`: ADMIN oder MEMBER).

### Verzeichnis

Ein vom Administrator angelegter Ordner **einer Ebene** zur Gliederung von
[[Dokument]]en innerhalb eines Bereichs (Admin oder Mitglieder). Dokumente ohne
Verzeichnis liegen in der Wurzel („/“).

- _Code:_ Prisma-Modell `DocumentDirectory`.
- _Vermeiden:_ „Ordner“ (einheitlich „Verzeichnis“).

## E-Mail-Versand

### Postausgang

Die Warteschlange aller von der Webseite erzeugten E-Mails. Jede E-Mail wird zuerst
**eingereiht** und anschließend im Hintergrund versendet; fehlgeschlagene Sendeversuche
werden innerhalb eines Zeitfensters automatisch wiederholt, danach können
Administratoren sie manuell erneut einplanen. **„Versendet“ bedeutet: an den
Mail-Server übergeben** — nicht, dass die E-Mail zugestellt wurde.

- _Code:_ Prisma-Modell `OutgoingEmail` (Status: `OutgoingEmailStatus`).
- _Vermeiden:_ „Outbox“ in der Fachsprache (technisch geläufig, deutsch „Postausgang“).

## Standorte

### Standort

Ein Schießstand bzw. Veranstaltungsort mit Adresse und Koordinaten, den Administratoren
pflegen und der zur Kartenanzeige eines [[Termin]]s dient.

- _Code:_ Prisma-Modell `ShootingRange`.
- _Vermeiden:_ „Schießstand“, „Location“ (in der Fachsprache „Standort“).

## Einladungen

### Einladung

Ein zeitlich befristeter, tokenbasierter Zugang, über den ein Administrator eine neue
Person einlädt, ein [[Benutzer]]konto anzulegen. Ersetzt die (nicht existierende)
öffentliche Registrierung.

- _Code:_ Prisma-Modell `Invitation`.
- Abzugrenzen vom [[Login]] (bestehendes Konto) und von der [[Teilnahmeanmeldung]].
- _Vermeiden:_ „Registrierung“.

### Passwort zurücksetzen

Der tokenbasierte, zeitlich befristete Weg, über den ein [[Benutzer]] mit bestehendem
Konto ein neues Passwort setzt („Passwort vergessen“). Jeder Link ist nur einmal
verwendbar.

- _Code:_ Prisma-Modell `PasswordReset`.
- Abzugrenzen von der [[Einladung]] (neues Konto).

### Impersonierung

Die Übernahme der Sitzung eines anderen [[Benutzer]]s durch einen
**Site-Administrator** zu Support-Zwecken. Während der Impersonierung handelt der
Site-Administrator mit den Rechten und der Identität des Zielbenutzers; Beginn und
Ende werden protokolliert.

- Nur die [[Rolle]] `SITE_ADMINISTRATOR` darf impersonieren.

## News

### News

Eine vom Administrator veröffentlichte Neuigkeit/Mitteilung auf der Webseite.

- _Code:_ Prisma-Modell `News`.
- _Vermeiden:_ „Neuigkeit“, „Beitrag“, „Artikel“ (einheitlich „News“).

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
erscheinen im Vordergrund („aktuell“).

### Historische Ausschreibung (abgelaufen)

Eine [[Ausschreibung]], deren [[Ablaufdatum]] überschritten ist — historisch also erst
**ab dem Tag nach** dem Ablaufdatum. Sie bleibt dauerhaft einsehbar (Historie/Archiv),
erscheint aber nicht mehr unter „aktuell“.
Der Übergang aktuell → historisch geschieht automatisch anhand des Ablaufdatums,
ohne manuelle Aktion.

### Ablaufdatum

Das vom Administrator gesetzte „Anzeigen bis“-Datum einer [[Ausschreibung]]. Frei
wählbar; empfohlener Vorschlag ist das Veranstaltungsdatum. Eine Ausschreibung
gilt **bis einschließlich** dieses Tages als aktuell und erst **am Tag danach**
als historisch. Das Ablaufdatum bestimmt allein (rein rechnerisch, ohne
Statusfeld) die Zuordnung zu aktuell bzw. historisch.

- _Vermeiden:_ „Meldeschluss“ — die Anmeldung läuft außerhalb dieser Webseite, das
  Ablaufdatum sagt nichts über eine Anmeldefrist aus. Ebenso „Veranstaltungsdatum“:
  es ist nur der empfohlene Wert, nicht die Bedeutung des Feldes.

### Nächste Ausschreibung

Die [[Aktuelle Ausschreibung]] mit dem frühesten [[Ablaufdatum]] — die also als
nächstes aus der Anzeige fällt. Bezugspunkt für Hinweise wie „Nächste Ausschreibung“
auf der Startseite. Gibt es keine aktuelle Ausschreibung, gibt es auch keine nächste.
