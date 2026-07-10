# Deutsche Fachsprache, englischer Code

Die kanonische Fachsprache (Ubiquitous Language) dieses Projekts ist **Deutsch** und in
`CONTEXT.md` verbindlich festgehalten: UI, Routen, Inhalte, Issues und Diskussionen
verwenden die dortigen deutschen Begriffe. Der **Code bleibt englisch** — Prisma-Modelle
und Enums heißen weiterhin `User`, `Event`, `Vote`, `Poll`, `Document`, `Invitation`,
`ShootingRange` usw. `CONTEXT.md` bildet jeden Fachbegriff über eine `_Code:_`-Zeile auf
das zugehörige Modell ab.

## Considered Options

- **Gewählt:** Deutsche Fachsprache + englische Code-/DB-Namen. Die Domänensprache ist
  konsistent deutsch (die UI ist bewusst deutschsprachig), ohne den bestehenden englischen
  Code umzubenennen. `CONTEXT.md` überbrückt beide Welten.
- **Verworfen:** Prisma-Modelle ins Deutsche umbenennen. Große, rein mechanische Migration
  mit Risiko, ohne fachlichen Mehrwert.
- **Verworfen:** Englische Fachsprache auch in UI/Doku. Widerspricht der deutschsprachigen
  Zielgruppe des Vereins.

## Consequences

- Ein englisches Modell (z. B. `Vote`) und ein deutscher Begriff (z. B.
  Teilnahmeanmeldung) können unterschiedlich heißen — die Zuordnung steht ausschließlich
  in `CONTEXT.md`.
- Neuer Code sollte englische Namen **nicht** als Beleg für die Fachsprache heranziehen;
  maßgeblich ist `CONTEXT.md`. Vermeintliche „Inkonsistenzen" zwischen englischem Code und
  deutscher UI sind gewollt und kein Aufräum-Anlass.

## Bewusste Ausnahme: `model Ausschreibung`

Das Prisma-Modell `Ausschreibung` (samt zugehöriger Dateien wie
`lib/ausschreibung-*.ts`) trägt bewusst den deutschen Namen: Für den Fachbegriff gibt es
keine treffende englische Entsprechung („tender"/„call for entries" wären irreführend),
und das Modell entstand nach Einführung der Fachsprache direkt aus `CONTEXT.md` (vgl.
ADR-0001). Diese Ausnahme ist kein Präzedenzfall — bestehende englische Modellnamen
bleiben englisch, und neue Modelle erhalten englische Namen, sofern eine etablierte,
eindeutige Übersetzung existiert.
