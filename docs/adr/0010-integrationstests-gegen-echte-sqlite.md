# Integrationstests laufen gegen echte SQLite, die Unit-Schicht behält ihre Mocks

Die Testsuite besteht aus zwei Schichten mit bewusst unterschiedlichen Regeln:

- **Unit-/Komponentenschicht** (Bestand, `__tests__/*.test.ts[x]`): jsdom,
  `jest.setup.js` mockt `next/server` und `next-auth` global, der Prisma-Client wird
  je Test gemockt. Schnell, isoliert, testet Logik und UI-Verhalten.
- **Integrationsschicht** (`__tests__/integration/`): eigenes Jest-Projekt mit
  `node`-Environment, **ohne** die globalen Mocks. Pro Lauf eine frische
  SQLite-Datei, auf die alle Migrationen angewendet werden; die Route-Handler laufen
  gegen den echten Prisma-Client und das echte Schema.

Beide Schichten laufen in `pnpm test` und damit im Deploy-Gate von `deploy.sh`.

## Considered Options

- **Gewählt: zweite Schicht mit echter Datenbank neben der Mock-Schicht.** Die
  Mock-Schicht kann eine ganze Fehlerklasse prinzipiell nicht sehen: falsche Queries,
  verletzte Unique-Constraints, Schema-Abweichungen, Verhalten des echten
  `next/server`. Da Änderungen hier oft „trocken“ entstehen und direkt nach
  Produktion deployt werden, muss diese Klasse **vor** dem Deploy auffallen. Der
  Preis — zwei Schichten mit unterschiedlichen Setup-Regeln — wird bewusst gezahlt.
- **Verworfen: alle Tests auf die echte Datenbank umstellen.** ~142 bestehende
  Testdateien sind auf die globalen Mocks gebaut; ein Umbau wäre wochenlange Arbeit
  ohne neuen Erkenntnisgewinn, und die Suite würde erheblich langsamer.
- **Verworfen: nur die Mock-Schicht verdichten.** Mehr Fälle gegen dieselben Mocks
  erhöhen die Sicherheit nicht dort, wo sie fehlt — der Mock bestätigt nur die
  Annahmen, die in ihn hineingesteckt wurden.
- **Verworfen: stattdessen den Selbsttest in Produktion ausbauen.** `/api/selftest`
  findet Fehler erst **nach** dem Umschalten; der Rollback fängt das zwar ab, aber
  Produktion war kurz betroffen. Der Selbsttest bleibt Ergänzung (Post-Deploy-Gate),
  nicht Ersatz.

## Consequences

- In der Integrationsschicht sind Mocks die Ausnahme und auf Systemgrenzen
  beschränkt (z. B. SMTP-Transport, Systemzeit). Wer dort Prisma oder `next/server`
  mockt, hebt den Zweck der Schicht auf.
- Neue Fachlogik mit DB-Constraints, Tokens, Zustandsautomaten oder Datumslogik
  bekommt ihren Test bevorzugt in der Integrationsschicht; reine Logik und UI bleiben
  in der Unit-Schicht.
- `pnpm test` wird langsamer (Migrationen + echte DB je Lauf); das ist als
  Deploy-Gate-Kosten akzeptiert.
- Die Schichten dürfen nicht vermischt werden: `jest.setup.js` gehört
  ausschließlich zur Unit-Schicht.
