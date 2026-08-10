# 05 — Optionale Platzzahl am Termin

Status: done

**What to build:** Ein Administrator kann an einem [[Termin]] hinterlegen, wie viele
Plätze es gibt. Mitglieder und öffentliche Besucher sehen die Zahl und können einschätzen,
wie begehrt der Termin ist.

Die entscheidende Eigenschaft dieses Feldes ist, was es **nicht** tut: Die Platzzahl ist
eine **Information, keine Sperre**. Sie verhindert keine [[Teilnahmeanmeldung]], erzeugt
keine Warteliste und lässt niemanden nachrücken. Die [[Teilnahmeanmeldung]] bleibt
ausdrücklich unverbindlich (Ja/Nein/Vielleicht), und wer am Ende teilnimmt, klärt der
Verein außerhalb der Webseite.

Weil ein Feld namens „Plätze“, das nichts erzwingt, für spätere Leser überraschend ist,
gehört zu diesem Ticket ein **ADR**, der die Entscheidung samt der verworfenen
Alternativen festhält (harte Anmeldesperre, automatische Warteliste).

Das Feld gilt für **alle** Terminarten — auch ein Training kann durch die Zahl der Bänke
begrenzt sein.

Die Anzeige der **Belegung** („7 von 12 belegt“) ist bewusst **nicht** Teil dieses
Tickets, sondern folgt in 06.

**Blocked by:** None — can start immediately. (Berührt dieselben Flächen wie 03 und 04;
wenn seriell gearbeitet wird, nacheinander umsetzen.)

- [x] Der Termin hat ein optionales Feld für die Platzzahl; die Schemaerweiterung kommt
      mit einer eigenen, idempotenten Migration und einem Eintrag in der
      Migrationshistorie.
- [x] Die Platzzahl lässt sich im Termin-Formular erfassen, ändern und wieder leeren; eine
      leere Eingabe gilt als „nicht gesetzt“.
- [x] Serverseitig werden nur positive ganze Zahlen akzeptiert; Null, negative Werte und
      Nachkommastellen werden mit einer verständlichen Meldung abgelehnt.
- [x] Ist eine Platzzahl gesetzt, erscheint sie auf der Termin-Detailseite; ohne
      Platzzahl erscheint keine leere Zeile und kein Platzhalter.
- [x] Die Platzzahl ist ohne Login sichtbar.
- [x] Eine gesetzte Platzzahl verändert das Verhalten der Teilnahmeanmeldung in keiner
      Weise — Anmeldungen sind weiterhin unbegrenzt möglich, auch über die Platzzahl
      hinaus.
- [x] Das Feld steht bei jeder Terminart zur Verfügung.
- [x] Ein ADR unter `docs/adr/` hält fest, dass die Kapazitätsangabe informativ ist und
      keine Anmeldung sperrt, und nennt die verworfenen Alternativen.
