# 03 — Optionaler Titel am Termin

Status: done

**What to build:** Ein Administrator kann einem [[Termin]] einen Titel geben — zum
Beispiel „Dynamisches Pistolenschießen Level 1“. Mitglieder und öffentliche Besucher sehen
den Titel als Überschrift in der Terminliste und auf der Detailseite, in geteilten Links
und Suchergebnissen, und Mitglieder lesen ihn zusätzlich in der [[Termin-Erinnerung]] —
die heute nur Datum, Uhrzeit und Ort nennt und damit nicht verrät, worum es überhaupt
geht.

Der Titel ist **optional**. Wo keiner gesetzt ist, verhält sich die Seite **exakt wie
heute**: das Datum als Überschrift, „Termin am …“ als Seitentitel, die gewohnte
Erinnerungsmail. Bestandstermine ändern ihr Erscheinungsbild dadurch nicht und müssen
nicht nachgepflegt werden. Genau dieses Rückfallverhalten ist der Kern des Tickets —
nicht das Feld selbst.

Der Titel **ersetzt** Datum, Uhrzeit und Ort nirgends; er tritt daneben.

**Blocked by:** None — can start immediately. (Berührt dieselben Flächen wie 04 und 05;
wenn seriell gearbeitet wird, nacheinander umsetzen.)

- [x] Der Termin hat ein optionales Titelfeld; die Schemaerweiterung kommt mit einer
      eigenen, idempotenten Migration und einem Eintrag in der Migrationshistorie.
- [x] Der Titel lässt sich im Termin-Formular erfassen, ändern und wieder leeren; eine
      leere Eingabe gilt als „nicht gesetzt“.
- [x] Die Länge des Titels ist serverseitig begrenzt, analog zu den übrigen Termin-Feldern.
- [x] Mit Titel: Terminkarte und Detailseite zeigen ihn als Überschrift, Datum und Uhrzeit
      bleiben zusätzlich sichtbar.
- [x] Ohne Titel: Terminkarte und Detailseite sehen unverändert aus wie vor diesem Ticket.
- [x] Mit Titel: Seitentitel und OpenGraph-Titel nennen den Titel; ohne Titel bleibt es
      bei „Termin am …“.
- [x] Mit Titel: Die Termin-Erinnerung nennt Titel und [[Terminart]] zusätzlich zu Datum,
      Uhrzeit und Ort; ohne Titel ist die E-Mail unverändert.
- [x] Der Titel ist ohne Login sichtbar.
