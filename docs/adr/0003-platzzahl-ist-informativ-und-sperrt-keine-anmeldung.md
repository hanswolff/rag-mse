# Die Platzzahl am Termin ist informativ und sperrt keine Anmeldung

Ein [[Termin]] kann eine **Platzzahl** tragen (`Event.capacity`). Sie ist eine reine
Anzeige: Die Seite zählt und zeigt an, sie verhindert nichts. Liegen mehr
Ja-Anmeldungen vor als Plätze da sind, erscheint im Adminbereich ein Hinweis — die
[[Teilnahmeanmeldung]] bleibt trotzdem für jeden weiterhin möglich. Wer am Ende
teilnimmt, klärt der Verein außerhalb dieser Webseite.

Ein Feld namens „Plätze“, das nichts erzwingt, ist für spätere Leser überraschend;
deshalb ist die Entscheidung hier festgehalten.

## Considered Options

- **Gewählt: informative Kapazität.** Die Platzzahl ist ein Planungswert für den
  Administrator und eine Orientierung für Mitglieder. Sie passt zum ausdrücklich
  unverbindlichen Charakter der Teilnahmeanmeldung (Ja/Nein/Vielleicht) und kommt
  ohne zusätzlichen Zustand aus — die Belegung wird berechnet, nicht gespeichert.
- **Verworfen: harte Anmeldesperre.** Sie erzeugt Wettlaufsituationen bei
  gleichzeitigen Anmeldungen, macht „Vielleicht“ bedeutungslos (belegt eine
  Vielleicht-Antwort einen Platz oder nicht?) und widerspricht der Unverbindlichkeit
  der Teilnahmeanmeldung.
- **Verworfen: automatische Warteliste mit Nachrücken.** Sie braucht eine belastbare
  Reihenfolge. Der Zeitstempel der Anmeldung taugt dafür nicht: Wer erst „Nein“ wählt
  und später auf „Ja“ wechselt, behält den ursprünglichen Anlagezeitpunkt und stünde
  vor später hinzugekommenen Zusagen. Dazu kämen Nachrückregeln und
  Benachrichtigungen — ein eigenes Vorhaben.

## Consequences

- Es gibt keine Warteliste, kein Nachrücken und keinen Anmeldestopp.
- Überbuchung ist ein zulässiger Zustand und wird nur sichtbar gemacht.
- Wird die Entscheidung später zurückgedreht, ist die Reihenfolge-Falle des
  Anmelde-Zeitstempels unbedingt zu beachten.
- Die Entscheidung ist gegenüber Mitgliedern schwer zurückzunehmen: Eine einmal
  eingeführte verbindliche Platzvergabe erzeugt Erwartungen, die sich nicht wieder
  einfangen lassen.
