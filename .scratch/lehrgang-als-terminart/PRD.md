# Lehrgang als dritte Terminart, mit Titel, Kosten und Plätzen

Status: done

## Problem Statement

Der Verein bietet künftig angeleitete Kurse an — der erste konkrete Fall ist ein Kurs mit
Frank Thiel (Baltic Shooters), den der Verein bucht und der für unsere Mitglieder auf
unserem Stand stattfindet. Die Anmeldung läuft über diese Webseite.

Ein solcher Termin lässt sich heute nicht sauber einordnen. Die [[Terminart]] kennt nur
**Training** und **Wettkampf**; beides trifft nicht zu. Wer den Kurs als „Training“
einträgt, vermischt ihn mit dem regelmäßigen Übungsbetrieb, wer ihn als „Wettkampf“
einträgt, behauptet eine Wertung, die es nicht gibt. Lässt der Administrator die
Terminart leer, verschwindet die Einordnung ganz.

Zusätzlich fehlen dem [[Termin]] genau die Angaben, die einen gebuchten Kurs ausmachen:

- **Worum es geht.** Ein Termin hat heute keinen Titel. In der Terminliste steht das
  Datum als Überschrift; „Dynamisches Pistolenschießen Level 1“ hat keinen Platz außer
  irgendwo in der Beschreibung. Auch die [[Termin-Erinnerung]] nennt nur Datum, Uhrzeit
  und Ort — der Empfänger sieht nicht, worum es überhaupt geht.
- **Was er kostet.** Ein gebuchter Kurs ist kostenpflichtig, oft gestaffelt nach
  Mitglied und [[Gast]].
- **Wie viele mitkönnen.** Ein Kurs mit Trainer hat eine begrenzte Teilnehmerzahl. Heute
  sieht der Administrator zwar die Zahl der [[Teilnahmeanmeldung]]en, hat aber keinen
  Bezugswert, gegen den er sie halten kann.

## Solution

Der [[Termin]] bekommt eine dritte [[Terminart]] namens **Lehrgang** sowie drei neue,
durchgehend **optionale** Angaben, die für *alle* Terminarten gelten: **Titel**,
**Kosten** und **Plätze**. Für eingeloggte Benutzer zeigt die Seite zusätzlich die
**Belegung** — wie viele der Plätze durch Ja-Anmeldungen bereits vergeben sind.

Die drei Terminarten grenzen sich künftig so ab:

- **Training** — regelmäßiger eigener Übungsbetrieb ohne externe Anleitung.
- **Wettkampf** — Termin mit Wertung.
- **Lehrgang** — angeleitete Vermittlung von Wissen oder Können, typischerweise mit
  gebuchtem Referenten, Kosten und begrenzter Teilnehmerzahl.

Entscheidend für das Verständnis des Features: **Die Platzzahl ist eine Information,
keine Sperre.** Die Seite zählt und zeigt an, sie verhindert nichts. Melden sich mehr
Personen mit „Ja“ an, als es Plätze gibt, weist die Seite den Administrator darauf hin —
wer tatsächlich teilnimmt, klärt der Verein außerhalb der Webseite. Es gibt keine
Warteliste, kein Nachrücken und keinen Anmeldestopp.

Wo kein Titel gesetzt ist, verhält sich die Seite exakt wie heute. Bestandstermine
ändern ihr Erscheinungsbild dadurch nicht und müssen nicht nachgepflegt werden.

## User Stories

### Administrator

1. Als Administrator möchte ich einen Termin als „Lehrgang“ einordnen können, damit
   gebuchte Kurse nicht als Training oder Wettkampf verfälscht werden.
2. Als Administrator möchte ich die Terminart weiterhin leer lassen können, damit
   Termine ohne klare Einordnung wie bisher anlegbar bleiben.
3. Als Administrator möchte ich einem Termin einen Titel geben können, damit Mitglieder
   auf den ersten Blick erkennen, worum es geht.
4. Als Administrator möchte ich den Titel weglassen können, damit ich für das
   wöchentliche Training keinen Namen erfinden muss.
5. Als Administrator möchte ich die Kosten als freien Text erfassen können, damit ich
   gestaffelte Preise wie „25 € für Mitglieder, 40 € für Gäste“ abbilden kann.
6. Als Administrator möchte ich „kostenfrei“ als Kostenangabe schreiben können, damit
   auch die ausdrückliche Kostenfreiheit sichtbar ist.
7. Als Administrator möchte ich die Zahl der verfügbaren Plätze erfassen können, damit
   ich die Kapazität eines Kurses dokumentiere.
8. Als Administrator möchte ich Kosten und Plätze auch bei Training und Wettkampf
   erfassen können, damit ich nicht erst die Terminart ändern muss, um ein begrenztes
   oder kostenpflichtiges Training abzubilden.
9. Als Administrator möchte ich sehen, wie viele der Plätze durch Ja-Anmeldungen belegt
   sind, damit ich die Auslastung eines Lehrgangs einschätzen kann.
10. Als Administrator möchte ich zusätzlich sehen, wie viele Personen mit „Vielleicht“
    geantwortet haben, damit ich die verbleibende Unsicherheit einschätzen kann.
11. Als Administrator möchte ich einen deutlichen Hinweis erhalten, wenn mehr
    Ja-Anmeldungen als Plätze vorliegen, damit ich rechtzeitig eingreifen kann.
12. Als Administrator möchte ich, dass die Seite bei Überbuchung trotzdem keine Anmeldung
    verweigert, damit ich die Teilnehmerauswahl selbst treffen kann.
13. Als Administrator möchte ich alle drei neuen Angaben nachträglich ändern können,
    damit ich auf Absagen oder Preisänderungen reagieren kann.
14. Als Administrator möchte ich Lehrgänge in der Terminverwaltung an einem eigenen
    Farb-Badge erkennen, damit ich sie in der Liste sofort von Trainings und Wettkämpfen
    unterscheide.
15. Als Administrator möchte ich einen Lehrgang wie jeden anderen Termin ausblenden
    können, damit ich ihn vorbereiten kann, bevor er öffentlich wird.

### Mitglied

16. Als Mitglied möchte ich in der Terminliste erkennen, ob ein Termin ein Lehrgang ist,
    damit ich weiß, ob mich dort ein Trainer erwartet.
17. Als Mitglied möchte ich den Titel eines Termins als Überschrift sehen, damit ich den
    Termin am Thema statt nur am Datum erkenne.
18. Als Mitglied möchte ich die Kosten sehen, bevor ich mich anmelde, damit ich weiß,
    worauf ich mich einlasse.
19. Als Mitglied möchte ich die Zahl der Plätze sehen, damit ich einschätzen kann, wie
    begehrt der Termin ist.
20. Als Mitglied möchte ich sehen, wie viele Plätze bereits belegt sind, damit ich
    entscheiden kann, ob sich eine Anmeldung noch lohnt.
21. Als Mitglied möchte ich mich zu einem Lehrgang genauso mit Ja/Nein/Vielleicht
    anmelden können wie zu jedem anderen Termin, damit ich keine neue Bedienlogik lernen
    muss.
22. Als Mitglied möchte ich meine Anmeldung zu einem Lehrgang zurückziehen können, damit
    ich meine Meinung ändern kann.
23. Als Mitglied möchte ich in der Termin-Erinnerung den Titel und die Terminart lesen,
    damit ich aus der E-Mail heraus weiß, worum es geht, ohne die Seite zu öffnen.
24. Als Mitglied möchte ich, dass Erinnerungen zu Terminen ohne Titel unverändert
    aussehen, damit sich für gewohnte Termine nichts ändert.

### Gast und öffentliche Besucher

25. Als Gast möchte ich Titel, Terminart, Kosten und Platzzahl eines Lehrgangs ohne Login
    sehen, damit ich entscheiden kann, ob ich teilnehmen möchte.
26. Als Gast möchte ich mich zu einem Lehrgang anmelden können, damit ich als
    Nichtmitglied an offenen Kursen teilnehmen kann.
27. Als Gast möchte ich, dass meine Ja-Anmeldung einen Platz belegt, damit die
    Belegungszahl der Realität entspricht.
28. Als Besucher ohne Login möchte ich die Belegung **nicht** sehen, damit die
    Beteiligung im Verein nicht öffentlich ist.
29. Als Besucher möchte ich beim Teilen eines Lehrgangs-Links einen sprechenden Titel
    sehen, damit der geteilte Link nicht nur „Termin am …“ heißt.
30. Als Suchmaschine möchte ich für Termine mit Titel einen aussagekräftigen Seitentitel
    erhalten, damit öffentliche Lehrgänge auffindbar sind.

### Prüfer

31. Als Prüfer möchte ich Lehrgänge samt Kosten, Plätzen und Belegung lesen können, damit
    ich den Terminbetrieb prüfen kann, ohne etwas ändern zu dürfen.

## Implementation Decisions

### Terminart

- Die [[Terminart]] bleibt ein **nullbares Freitextfeld mit deutschen Werten**. „Lehrgang“
  kommt als dritter Wert zur bestehenden zentralen Terminarten-Konstante hinzu. Es ist
  **keine Datenbankmigration für die Terminart** nötig.
- Verworfen: Umstellung auf ein Prisma-Enum (`TRAINING`/`WETTKAMPF`/`LEHRGANG`). Das wäre
  näher an ADR-0002 (englischer Code, deutsche Oberfläche) und würde Tippfehler
  ausschließen, kostet aber eine Datenmigration aller Bestandstermine und berührt jede
  Schreib- und Lesestelle — ohne fachlichen Mehrwert für dieses Feature.
- Die Terminarten-Konstante wird zur **einzigen Quelle**. Das Auswahlfeld im
  Termin-Formular und die Fehlermeldungen der Terminvalidierung leiten sich daraus ab.
  Heute hält das Formular die Optionen doppelt vor, und die Fehlermeldung zählt die
  erlaubten Werte im Text hartkodiert auf — beides würde beim dritten Wert auseinander
  laufen.

### Darstellung der Terminart

- Die Farbzuordnung der Terminart wird zu einer **an einer Stelle definierten
  Zuordnungstabelle** (Terminart → Darstellungsklassen), die von Terminkarte,
  Admin-Terminliste und Termin-Detailseite gemeinsam genutzt wird.
- Das ist ein notwendiger Umbau, keine Kür: Heute steht an allen drei Stellen dieselbe
  Zweiwege-Bedingung („Training? blau : orange“). Jede neue Terminart würde dadurch still
  in der Wettkampf-Farbe erscheinen.
- **Lehrgang erhält Marken-Gold** (`brand-gold-100` als Fläche, `brand-gold-800` als
  Schrift). Begründung: Gold ist die dritte Vereinsfarbe und im Projekt noch nirgends
  belegt. Grün und Violett sind für Erfolgs- und Statusanzeigen vergeben, Bernstein
  markiert bereits „noch nicht öffentlich“, und Rot ist die Farbe für Fehler.
- Vorbild für die Struktur sind die vorhandenen Beschriftungs-Hilfsfunktionen der
  [[Umfrage]] (Typ- und Status-Labels).

### Neue Felder am Termin

- Der Termin bekommt drei **optionale** Felder: **Titel** (Freitext), **Kosten** (kurzer
  Freitext) und **Plätze** (positive Ganzzahl).
- Alle drei gelten für **jede** Terminart. Es gibt bewusst **keine typabhängigen Felder
  und keine typabhängige Validierung**: Auch ein Training kann durch die Zahl der Bänke
  begrenzt und ein Wettkampf mit einer Startgebühr belegt sein. Typabhängige Felder
  würden zudem die Frage aufwerfen, was beim Wechsel der Terminart mit bereits gesetzten
  Werten geschieht.
- **Kosten sind Freitext, kein Betrag.** Ein Dezimalfeld erzwingt genau einen Preis;
  Staffelungen nach Mitglied/Gast müssten dann doch wieder in die Beschreibung, und der
  Wert „0“ wäre mehrdeutig (kostenlos oder noch unbekannt?). Ausgewertet oder sortiert
  wird über die Kosten nirgends.
- Für alle drei Felder gelten Längen- bzw. Wertebereichsgrenzen analog zu den bestehenden
  Termin-Feldern; leere Eingaben werden wie „nicht gesetzt“ behandelt.

### Belegung

- Die **Belegung wird berechnet, nicht gespeichert.** Es gibt kein Zählerfeld, das
  konsistent gehalten werden müsste.
- Gezählt werden **Ja-Anmeldungen von Mitgliedern und von Gästen**. „Vielleicht“ belegt
  keinen Platz, wird aber als Zusatz ausgewiesen („+3 vielleicht“), damit die Unsicherheit
  sichtbar bleibt.
- Verworfen: nur Mitglieder zählen (bei offenen Lehrgängen sind Gäste gerade die
  Zielgruppe, die Zahl wäre irreführend) sowie Ja und Vielleicht gemeinsam zählen
  (überzeichnet regelmäßig und macht die Zahl als Planungsgrundlage unbrauchbar).
- Das bestehende Modul für Anmeldezahlen kennt bereits die Unterscheidung
  „mindestens = Ja“ und „höchstens = Ja + Vielleicht“. Die Belegung baut darauf auf,
  statt eine zweite Zählweise einzuführen.
- Ist keine Platzzahl gesetzt, bleibt die Anzeige der Anmeldungen exakt wie heute.

### Kapazität ist informativ

- Die Platzzahl **sperrt nichts**. Kein Anmeldestopp, keine Warteliste, kein Nachrücken.
  Bei Überschreitung erscheint lediglich ein Hinweis im Adminbereich.
- Verworfen: harte Anmeldesperre (erzeugt Wettlaufsituationen bei gleichzeitigen
  Anmeldungen, macht „Vielleicht“ bedeutungslos und widerspricht dem ausdrücklich
  unverbindlichen Charakter der [[Teilnahmeanmeldung]]) sowie automatische Warteliste
  (benötigt eine belastbare Reihenfolge — der Zeitstempel der Anmeldung ist dafür
  untauglich, weil ein Wechsel von „Nein“ auf „Ja“ den ursprünglichen Zeitpunkt behält —
  plus Nachrückregeln und Benachrichtigungen).
- Für diese Entscheidung wird ein **ADR** angelegt: Sie ist für spätere Leser
  überraschend (ein Feld „max. Teilnehmer“, das nichts erzwingt), sie war eine echte
  Abwägung, und sie zurückzudrehen erzeugt bei Mitgliedern Erwartungen, die sich schwer
  wieder einfangen lassen.

### Sichtbarkeit

- **Öffentlich:** Titel, Terminart, Kosten und die Gesamtzahl der Plätze. Das sind
  Eigenschaften des Termins und bewerben den Lehrgang.
- **Nur für eingeloggte Benutzer:** die Belegung. Sie ist ein Ergebnis der
  [[Teilnahmeanmeldung]], und dafür gilt die bestehende Regel aus `CONTEXT.md` und
  `AGENTS.md`: Anmeldungen und deren Ergebnisse sind nicht öffentlich.
- Die Terminlisten übergeben bereits heute ein Kennzeichen an die Terminkarte, ob
  Anmeldeergebnisse gezeigt werden dürfen. Die Belegung nutzt **dieses vorhandene Gatter**
  statt eines zweiten.
- Die öffentliche Termin-API darf die Belegung nicht mitliefern — nicht anzeigen reicht
  nicht, sie darf gar nicht erst in der öffentlichen Antwort stehen.

### Titel und Rückfallverhalten

- Der Titel ist optional. Wo keiner gesetzt ist, bleibt **alles exakt wie heute**:
  das Datum als Überschrift der Terminkarte, „Termin am …“ als Seiten- und
  OpenGraph-Titel, die gewohnte Erinnerungsmail.
- Wo ein Titel gesetzt ist, erscheint er auf der Terminkarte, der Detailseite, im
  Seiten- und OpenGraph-Titel sowie in der Termin-Erinnerung. Datum, Uhrzeit und Ort
  bleiben überall zusätzlich sichtbar — der Titel ersetzt sie nicht.
- Verworfen: Titelpflicht (der Administrator müsste für jedes wöchentliche Training einen
  Namen erfinden, und der Bestand müsste nachgepflegt werden) sowie Titelpflicht nur bei
  Lehrgängen (widerspricht dem Grundsatz „keine typabhängigen Felder“ und macht die
  Validierung beim Umschalten der Terminart heikel).

### Persistenz und API

- Die drei neuen Felder erfordern eine **Schemaerweiterung und eine eigene, idempotente
  SQL-Migration** im projekteigenen Migrations-Runner. Ein Eintrag in der
  Migrationshistorie in `MIGRATIONS.md` gehört dazu.
- Die Schreib-Endpunkte des Adminbereichs nehmen die neuen Felder entgegen und
  validieren sie serverseitig mit denselben Regeln wie das Formular.
- Die Lese-Endpunkte liefern die neuen Felder mit; die Belegung ausschließlich in
  authentifizierten Antworten.

### Fachsprache

- `CONTEXT.md` wird erweitert: Die [[Terminart]] umfasst künftig Training, Wettkampf und
  **Lehrgang**. Dabei wird **Training geschärft** — durch die dritte Art wird der Begriff
  sonst unscharf, weil ein Kurs umgangssprachlich ebenfalls „Training“ ist.
- Neu aufzunehmen sind die Begriffe **Titel**, **Kosten**, **Plätze** und **Belegung**,
  jeweils mit dem Hinweis, dass die Belegung berechnet ist und nichts sperrt.
- Umgangssprachlich darf weiter von einem „Kurs“ gesprochen werden; kanonisch für die
  Kategorie ist **Lehrgang**.

## Testing Decisions

Ein guter Test prüft hier **äußeres Verhalten**: was ein Benutzer auf der Seite sieht,
was eine API-Antwort enthält, was eine Validierung akzeptiert oder ablehnt. Nicht
getestet werden interne Zwischenschritte — insbesondere nicht, *wie* die Farbzuordnung
oder die Belegungsberechnung intern aufgebaut ist.

Es werden **keine neuen Nähte** eingeführt. Alle Prüfungen hängen sich an vorhandene
Testflächen:

1. **Terminvalidierung** (`event-validation.test.ts`) — die höchste und wichtigste Naht
   für die Regeln: „Lehrgang“ wird akzeptiert, unbekannte Terminarten weiterhin
   abgelehnt, die Fehlermeldung nennt alle drei Arten; Titel, Kosten und Plätze sind
   optional, respektieren ihre Grenzen, und eine nicht-positive oder nicht-ganzzahlige
   Platzzahl wird abgelehnt. Vorbild: die bestehenden Validierungstests für
   Ausschreibungen, Umfragen und Dokumente.
2. **API-Verträge** (`events-api.test.ts`, `events-detail-api.test.ts` sowie die
   Admin-Termin-Endpunkte) — die neuen Felder werden gespeichert und ausgeliefert; die
   **öffentliche** Antwort enthält keine Belegung, die authentifizierte schon. Dieser
   Test ist der eigentliche Schutz der Sichtbarkeitsregel.
3. **Anzeige** (`termine-page.test.tsx`, `termine-detail-page.test.tsx`,
   `admin-termine-page.test.tsx`) — ein Lehrgang wird mit eigenem Badge dargestellt und
   ist von Training und Wettkampf unterscheidbar; Titel erscheint als Überschrift, ohne
   Titel bleibt das Datum die Überschrift; Kosten und Plätze erscheinen, wenn gesetzt;
   die Belegung erscheint nur bei eingeloggtem Benutzer; bei Überbuchung erscheint der
   Hinweis im Adminbereich.
4. **Formular** (`event-form-modal.test.tsx`) — die Auswahl bietet alle drei Terminarten
   plus „Kein Typ“ an, und die neuen Felder lassen sich befüllen und leer lassen.
5. **Termin-Erinnerung** (`event-reminder-worker.test.ts`, `email-templates.test.ts`) —
   mit Titel enthält die E-Mail Titel und Terminart, ohne Titel bleibt sie unverändert.
   Der Regressionsschutz für Bestandstermine liegt hier.
6. **Migration** (`run-db-migrations.test.ts`) — dieser Test spielt die gesamte
   Migrationskette in eine frische Datenbank ein und erzwingt, dass ein Schemavergleich
   gegen `schema.prisma` leer bleibt. Die neue Migration muss dort ohne Zusatzaufwand
   mitlaufen; schlägt er fehl, stimmen Migration und Schema nicht überein.

Die Belegungsformatierung ist eine reine Funktion und darf zusätzlich direkt geprüft
werden (Prior Art: die Tests der Pluralisierung und der Umfrage-Hilfsfunktionen) — aber
nur als Ergänzung zur Prüfung an der Seiten-Naht, nicht als Ersatz.

## Out of Scope

- **Anmeldesperre, Warteliste, Nachrücken.** Die Kapazität ist ausdrücklich informativ.
- **Mehrtägige Termine.** Ein Termin hat weiterhin genau ein Datum. Ein Wochenendlehrgang
  wird als zwei Termine angelegt. Ein optionales Enddatum würde Anzeige, Sortierung,
  Erinnerungslogik und den Vergangenheitsfilter berühren — ein eigenes Vorhaben.
- **Filter oder Sortierung nach Terminart** in der Terminliste. Gibt es heute nicht und
  kommt hier nicht dazu.
- **Eigenes Feld für Referent oder Anbieter.** „Lehrgang mit Frank Thiel (Baltic
  Shooters)“ steht im Titel bzw. in der Beschreibung.
- **Preismodell, Zahlung, Rechnungen.** Kosten sind ein Anzeigetext.
- **Umstellung der Terminart auf ein Enum** samt Datenmigration.
- **Anpassung des Kalender-Exports.**
- **Nachpflege bestehender Termine.** Alle Bestandstermine bleiben ohne Titel, Kosten und
  Plätze gültig und sehen unverändert aus.

## Further Notes

- Auslöser und erster realer Anwendungsfall ist der Kurs mit **Frank Thiel (Baltic
  Shooters)**. Weil der Verein bucht und die Anmeldung über diese Seite läuft, ist es
  fachlich ein [[Termin]] und ausdrücklich **keine** [[Ausschreibung]] — die Ausschreibung
  bleibt der externen Veranstaltung vorbehalten, bei der die Anmeldung woanders
  stattfindet. Käme später ein Lehrgang, den ein Fremdanbieter ausrichtet und bei dem man
  sich direkt dort anmeldet, gehört er in die Ausschreibungen.
- Das Modul für den Kalender-Export (ICS) besitzt zwar ein Titelfeld, hat aber derzeit
  **keinen Aufrufer** in der Anwendung — es ist nur durch seinen eigenen Test abgedeckt.
  Deshalb muss der Termin-Titel dort nicht verdrahtet werden. Sobald der Export einmal
  angebunden wird, ist der Titel der offensichtliche Kandidat für `SUMMARY`.
- Die Reihenfolge der Umsetzung sollte sein: Glossar und ADR zuerst (sie legen die
  Begriffe fest), dann Schema und Migration, dann Validierung, Formular und Anzeige,
  jeweils mit den Tests.
- Der Zeitstempel einer [[Teilnahmeanmeldung]] taugt nicht als Reihenfolge: Wer erst
  „Nein“ wählt und später auf „Ja“ wechselt, behält den ursprünglichen Anlagezeitpunkt.
  Diese Falle ist der Grund, warum eine Warteliste nicht nebenbei nachrüstbar ist — sie
  ist beim Wiederaufgreifen des Themas unbedingt zu beachten.
