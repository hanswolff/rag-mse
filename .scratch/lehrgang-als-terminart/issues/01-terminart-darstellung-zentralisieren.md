# 01 — Terminart zentral beschriften und einfärben (Prefaktor)

Status: done

**What to build:** Nichts, was ein Benutzer sieht — und genau das ist die Abnahme. Dieser
Prefaktor macht die nachfolgende Änderung erst möglich: Heute ist die Liste der
[[Terminart]]en an zwei Stellen unabhängig voneinander hinterlegt (in der zentralen
Konstante und noch einmal als hartkodierte Optionen im Termin-Formular), die
Fehlermeldung der Validierung zählt die erlaubten Werte im Text auf, und die Farbgebung
des Terminart-Kennzeichens steht dreifach als Zweiwege-Bedingung da („Training? blau :
orange“) — in der Terminkarte, in der Admin-Terminliste und auf der Termin-Detailseite.

Solange das so bleibt, würde jede neue Terminart stillschweigend in der Wettkampf-Farbe
erscheinen und im Formular gar nicht erst auswählbar sein, ohne dass irgendwo ein Fehler
auftritt.

Nach diesem Ticket gibt es genau **eine** Quelle für die Terminarten und **eine**
gemeinsame Zuordnung von Terminart zu Beschriftung und Darstellung, die alle drei
Anzeigeflächen nutzen. Vorbild für den Zuschnitt sind die vorhandenen
Beschriftungs-Hilfsfunktionen der [[Umfrage]].

**Blocked by:** None — can start immediately.

- [x] Das Auswahlfeld für die Terminart im Termin-Formular leitet seine Optionen aus der
      zentralen Terminarten-Konstante ab; die Option „Kein Typ“ bleibt erhalten.
- [x] Die Fehlermeldung bei ungültiger Terminart nennt die erlaubten Werte, ohne sie im
      Text hartzukodieren — sie ergibt sich aus derselben Konstante.
- [x] Terminkarte, Admin-Terminliste und Termin-Detailseite verwenden dieselbe, an einer
      Stelle definierte Zuordnung von Terminart zu Darstellungsklassen.
- [x] Eine Terminart ohne hinterlegte Farbe fällt auf eine neutrale Darstellung zurück —
      nicht auf die Wettkampf-Farbe.
- [x] Training erscheint unverändert blau, Wettkampf unverändert orange, ein Termin ohne
      Terminart zeigt weiterhin gar kein Kennzeichen.
- [x] Die gesamte bestehende Testsuite bleibt grün; es gibt keine sichtbare
      Verhaltensänderung.
