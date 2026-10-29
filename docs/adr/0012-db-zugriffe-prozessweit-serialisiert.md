# Datenbankzugriffe prozessweit serialisiert

`@prisma/adapter-better-sqlite3` arbeitet mit **einer** SQLite-Verbindung. Sein
interner Mutex serialisiert nur Transaktionen untereinander; eine Abfrage außerhalb
einer Transaktion lief ohne Sperre auf derselben Verbindung und landete im gerade
offenen `BEGIN`. Rollte die Transaktion zurück, war auch dieser fremde Schreibvorgang
weg — obwohl der Aufrufer bereits Erfolg gemeldet hatte (z. B. eine gespeicherte
Teilnahmeanmeldung, während die „Letzter Admin“-Sperre eine Rollenänderung
zurückrollt; oder das SENT-Update des Postausgangs → Doppelversand). Stand 7.10.0
unverändert (geprüft 30.09.2026).

`lib/serialized-sqlite-adapter.ts` umhüllt den Adapter: Jede Abfrage außerhalb einer
Transaktion (`queryRaw`, `executeRaw`, `executeScript`) und jeder
`startTransaction` nehmen denselben prozessweiten FIFO-Mutex; eine Transaktion hält
ihn bis `commit`/`rollback`. Abfragen über den Transaktions-Client laufen über das
Transaktionsobjekt und warten nicht; nach `commit`/`rollback` weist der Wrapper sie ab,
damit späte Abfragen (etwa nach Prismas Timeout) nicht ungesperrt auf der Verbindung
landen. `rollback` sendet vorsorglich selbst ein `ROLLBACK`: Prisma ruft es auch nach
einem gescheiterten `COMMIT` (z. B. verzögerte Fremdschlüsselprüfung), und SQLite ließe
die Transaktion sonst offen — der nächste `BEGIN` schlüge fehl und der Adapter-interne
Mutex bliebe für immer gesperrt.

## Considered Options

- **Gewählt: Sperre auf Adapter-Ebene.** Eine Stelle deckt alles ab, was Prisma an die
  Verbindung schickt — Modell-Operationen, `$queryRaw`/`$executeRaw`, Batch-
  `$transaction([...])`, implizite Transaktionen verschachtelter Writes, Worker
  (Postausgang, Erinnerungen, Wartung) im selben Prozess.
- **Verworfen: Prisma-Client-Extension (`$allOperations` + `$transaction`-Wrapper).**
  Erfasst Raw-Queries und Batch-Transaktionen nur mit Sonderfällen und müsste den
  Transaktions-Client von außen unterscheiden; die Adapter-Ebene kennt diesen
  Unterschied von selbst.
- **Verworfen: Zweite Verbindung nur für Transaktionen.** better-sqlite3 ist
  synchron; ein `SQLITE_BUSY`-Warten der zweiten Verbindung blockiert die Event-Loop
  bis zum `busy_timeout`.
- **Verworfen: nur mindern** (Rollbacks selten machen). Schließt das Fenster nicht.

## Consequences

- **In einer Transaktion nie den globalen `prisma` benutzen**, immer `tx`: eine
  Abfrage über `prisma` wartet auf die Sperre, die die eigene Transaktion hält, bis
  deren Timeout (Standard 5 s) sie abbricht.
- **Interaktive Transaktionen enthalten nur DB-Zugriffe.** Template-Rendering,
  Dateizugriffe, bcrypt-Hashing, Mailversand vorher erledigen — jede Wartezeit darin
  hält alle anderen Anfragen des Prozesses an (`lib/email-sender.ts` trennt dafür
  `renderTemplateEmail` von `enqueueRenderedEmail`).
- Durchsatz: SQLite schreibt ohnehin seriell, better-sqlite3 arbeitet synchron — die
  Sperre kostet einen Microtask je Abfrage. Lesezugriffe warten jetzt auch auf offene
  Transaktionen; bei kurzen Transaktionen ist das nicht messbar.
- Andere Prozesse (Migrations-Runner, Seed) haben eigene Verbindungen; zwischen
  Prozessen isoliert SQLite selbst.
