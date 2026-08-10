# 04 — Optionale Kostenangabe am Termin

Status: done

**What to build:** Ein Administrator kann an einem [[Termin]] erfassen, was die Teilnahme
kostet. Mitglieder und [[Gast]]e sehen die Angabe, bevor sie sich anmelden.

Die Kosten sind ein **kurzer Freitext**, kein Betrag: „25 € für Mitglieder, 40 € für
Gäste“ oder schlicht „kostenfrei“. Ein Zahlenfeld würde genau einen Preis erzwingen,
Staffelungen wieder in die Beschreibung drängen, und der Wert „0“ wäre mehrdeutig
(kostenlos oder noch unbekannt?). Ausgewertet oder sortiert wird über die Kosten
nirgends.

Das Feld gilt für **alle** Terminarten, nicht nur für Lehrgänge — auch ein Wettkampf kann
eine Startgebühr haben. Es gibt bewusst keine typabhängige Formularlogik.

**Blocked by:** None — can start immediately. (Berührt dieselben Flächen wie 03 und 05;
wenn seriell gearbeitet wird, nacheinander umsetzen.)

- [x] Der Termin hat ein optionales Kostenfeld als Freitext; die Schemaerweiterung kommt
      mit einer eigenen, idempotenten Migration und einem Eintrag in der
      Migrationshistorie.
- [x] Die Kosten lassen sich im Termin-Formular erfassen, ändern und wieder leeren; eine
      leere Eingabe gilt als „nicht gesetzt“.
- [x] Die Länge ist serverseitig begrenzt; das Feld ist für eine kurze Angabe gedacht,
      nicht für Fließtext.
- [x] Ist eine Kostenangabe gesetzt, erscheint sie auf der Termin-Detailseite; ist keine
      gesetzt, erscheint keine leere Zeile und kein Platzhalter.
- [x] Die Kostenangabe ist ohne Login sichtbar.
- [x] Das Feld steht bei jeder Terminart zur Verfügung — auch bei Training und Wettkampf
      und bei Terminen ohne Terminart.
