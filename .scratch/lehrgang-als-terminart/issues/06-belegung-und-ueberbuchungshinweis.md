# 06 — Belegung für eingeloggte Benutzer und Überbuchungshinweis

Status: done

**What to build:** Wer eingeloggt ist, sieht bei einem [[Termin]] mit hinterlegter
Platzzahl, wie viele Plätze bereits vergeben sind — etwa „7 von 12 Plätzen belegt
(+3 vielleicht)“. Ein Mitglied kann damit entscheiden, ob sich eine Anmeldung noch lohnt;
ein Administrator sieht die Auslastung eines Lehrgangs auf einen Blick und wird gewarnt,
wenn mehr Zusagen vorliegen als Plätze da sind.

Gezählt werden **Ja-Anmeldungen von [[Mitglied]]ern und von [[Gast]]en** — beide belegen
einen Platz. „Vielleicht“ belegt keinen, wird aber als Zusatz ausgewiesen, damit die
verbleibende Unsicherheit sichtbar bleibt. Das bestehende Modul für Anmeldezahlen kennt
diese Unterscheidung bereits („mindestens = Ja“, „höchstens = Ja + Vielleicht“); die
Belegung baut darauf auf, statt eine zweite Zählweise einzuführen.

Die Belegung wird **berechnet, nicht gespeichert** — es gibt kein Zählerfeld, das
konsistent gehalten werden müsste.

Sie ist ein Ergebnis der [[Teilnahmeanmeldung]] und damit **nicht öffentlich**: Für die
Anzeige der Anmeldeergebnisse gibt es bereits ein Login-Gatter, das die Terminlisten an
die Terminkarte durchreichen — die Belegung nutzt dieses vorhandene Gatter statt eines
zweiten. Wichtiger noch: Die Belegung darf in der **öffentlichen** Termin-API gar nicht
erst vorkommen. Nicht anzeigen genügt nicht.

Bei Überbuchung wird **nichts blockiert** — der Administrator bekommt lediglich einen
deutlichen Hinweis (siehe ADR aus Ticket 05).

**Blocked by:** 05 — Optionale Platzzahl am Termin. Ohne das Feld gibt es keinen
Bezugswert, gegen den gezählt werden könnte.

- [x] Ein eingeloggter Benutzer sieht bei einem Termin mit Platzzahl, wie viele Plätze
      durch Ja-Anmeldungen belegt sind, und wie viele Plätze es insgesamt gibt.
- [x] Ja-Anmeldungen von Mitgliedern und von Gästen zählen gleichermaßen mit.
- [x] „Vielleicht“-Antworten zählen nicht als belegt, werden aber als Zusatz ausgewiesen.
- [x] Ohne hinterlegte Platzzahl bleibt die Anzeige der Anmeldungen exakt wie vor diesem
      Ticket.
- [x] Ein Besucher ohne Login sieht die Belegung nicht — weder auf der Terminliste noch
      auf der Detailseite.
- [x] Die öffentliche Termin-API liefert keine Belegung mit; die authentifizierte schon.
- [x] Liegen mehr Ja-Anmeldungen vor als Plätze, erscheint im Adminbereich ein deutlicher
      Hinweis auf die Überbuchung.
- [x] Auch bei Überbuchung bleibt jede weitere Teilnahmeanmeldung möglich; es wird nichts
      gesperrt und niemand auf eine Warteliste gesetzt.
- [x] `CONTEXT.md` nimmt die Begriffe Kosten, Plätze und Belegung auf, mit dem Hinweis,
      dass die Belegung berechnet ist und nichts sperrt.
