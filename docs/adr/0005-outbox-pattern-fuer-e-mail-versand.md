# E-Mail-Versand über eine Outbox statt Direktversand

Kein Codepfad spricht SMTP direkt an. Wer eine E-Mail verschicken will, schreibt einen
Datensatz `OutgoingEmail` (Status `QUEUED`); ein In-Process-Worker
(`lib/email/outbox-worker.ts`) holt sich Datensätze, versendet sie und pflegt Status,
Versuchszähler und Wiedervorlagezeitpunkt.

## Considered Options

- **Gewählt: Outbox.** Der Versand hängt nicht mehr an der Lebensdauer des Requests.
  Ein langsamer oder kurz nicht erreichbarer SMTP-Server blockiert keine Antwort und
  verliert keine Nachricht; Wiederholversuche laufen mit Abstand, und in der
  Admin-Oberfläche ist einsehbar, was das System zu senden versucht hat.
- **Verworfen: Direktversand im Request.** Jeder SMTP-Aussetzer wäre entweder ein
  Fehler für den Benutzer oder ein stiller Verlust gewesen. Beides ist bei
  Einladungen, Passwort-Zurücksetzungen und Termin-Erinnerungen inakzeptabel — der
  Empfänger merkt nicht, dass etwas fehlt.
- **Verworfen: externe Queue (Redis/RabbitMQ).** Zusätzlicher Dienst mit eigenem
  Betrieb und Backup für eine Anwendung, die auf einem einzelnen Host mit SQLite läuft.

## Consequences

- Der Versand ist **asynchron**: Nach dem Request ist die E-Mail zugesagt, nicht
  zugestellt. Wer eine Zustellbestätigung braucht, muss den Outbox-Status ansehen.
- Der Worker läuft **im Anwendungsprozess**. Bei mehreren Instanzen bräuchte es eine
  Sperre über die Datenbank hinweg; die Übernahme eines Datensatzes ist deshalb schon
  heute als Claim mit `lockedUntil` gebaut.
- Anhänge und Empfänger liegen serialisiert im Datensatz. Sensible Link-Token werden
  vor dem Speichern ersetzt und erst beim Versand wieder eingesetzt
  (`lib/email/redact.ts`), damit die Outbox keine gültigen Token im Klartext hält.
- Die Tabelle wächst; das Aufräumen alter Datensätze gehört zum Betrieb.
