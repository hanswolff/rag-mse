# 05 — Integrationstests: Teilnahmeanmeldung und Termin-Erinnerung

Status: done

**What to build:** Integrationstests (Schicht aus Issue 03) für [[Teilnahmeanmeldung]]
und [[Termin-Erinnerung]] — die Flüsse mit Unique-Constraints und Worker-Dedup:

- **Teilnahmeanmeldung [[Mitglied]]:** Ja/Nein/Vielleicht abgeben, ändern,
  zurückziehen — gegen die echte DB. **Genau eine** Anmeldung pro Person und
  [[Termin]] (echter Constraint bzw. Upsert-Verhalten, nicht gemockt).
- **Teilnahmeanmeldung [[Gast]]:** Erfassung durch Admin, gleiche
  Einmaligkeitsregel.
- **[[Belegung]]:** wird aus echten Ja-Anmeldungen berechnet (Mitglieder + Gäste
  gleichermaßen, „Vielleicht“ belegt keinen Platz); die öffentliche Termin-API
  liefert sie **nicht** aus (nur eingeloggt sichtbar); [[Plätze]] sperren nichts —
  eine Anmeldung über die Platzzahl hinaus gelingt (ADR 0003).
- **Termin-Erinnerung (`event-reminder-worker`):** Der Worker läuft gegen die echte
  DB. Höchstens **eine** Erinnerung pro Benutzer und Termin (Dedup über
  `EventReminderDispatch` auch bei zweitem Lauf); Vorlaufzeit je Benutzer wird
  respektiert; erzeugte E-Mails landen im [[Postausgang]]; der Token-Link erlaubt
  die Anmeldung **ohne** [[Login]] und nur für den richtigen Termin/Benutzer.
- **Sichtbarkeit:** Ein ausgeblendeter Termin (`visible = false`) erscheint weder in
  der öffentlichen API noch für eingeloggte Mitglieder — nur im Adminbereich.

**Blocked by:** 03 — braucht die Integrations-Infrastruktur.

- [x] Doppelte Anmeldung derselben Person scheitert bzw. ersetzt die bestehende —
      geprüft am echten DB-Zustand (genau ein Datensatz).
- [x] Zweiter Worker-Lauf erzeugt keine zweite Erinnerung (Dispatch-Dedup real).
- [x] Token-Link-Anmeldung ohne Session funktioniert und schreibt den richtigen
      Datensatz; fremde/abgelaufene Token scheitern.
- [x] Belegungszahlen stimmen für gemischte Mitglieds-/Gast-Anmeldungen; die
      öffentliche API enthält keine Anmeldedaten.
