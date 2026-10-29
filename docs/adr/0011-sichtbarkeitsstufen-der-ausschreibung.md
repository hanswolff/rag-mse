# Sichtbarkeitsstufen der Ausschreibung statt eines Sichtbar-Flags

Eine [[Ausschreibung]] soll sich wie ein [[Termin]] ausblenden lassen. Zwei Motive
stecken hinter dem Wunsch, und sie verlangen Unterschiedliches: eine Ausschreibung
**zurückziehen** (falsches PDF, Wettbewerb abgesagt) heißt, sie muss verschwinden;
eine Ausschreibung **vorab intern zeigen** heißt, Mitglieder sollen sie schon sehen,
die Öffentlichkeit noch nicht. Ein Boolean `visible` wie am `Event` hält diese beiden
Absichten nicht auseinander. Wir modellieren die Achse deshalb als Enum
`AusschreibungVisibility` mit den Stufen `PUBLIC`, `MEMBER` und `HIDDEN`,
Default `PUBLIC`.

Die Stufe wirkt an **jeder** Stelle, an der eine Ausschreibung nach außen tritt —
Liste, Seite, Startseiten-Karte und der Datei-Endpunkt aus ADR-0001. Wer eine nicht
sichtbare Ausschreibung anfragt, bekommt 404, nicht 403: die Existenz einer
zurückgezogenen Ausschreibung ist selbst eine Information.

## Considered Options

- **Gewählt:** Enum mit drei Stufen. Bildet Rückzug und interne Vorabinformation
  getrennt ab und behält den häufigen Fall (PDF kommt an, soll sofort online) als
  Default ohne Zusatzklick.
- **Verworfen:** `visible Boolean @default(true)` analog `Event.visible`. Kleinstes
  Modell und gleiche Fachsprache wie beim Termin, aber Mitglieder sähen ausgeblendete
  Ausschreibungen dann gar nicht — die interne Vorabinformation wäre nicht möglich.
- **Verworfen:** Boolean auf der Achse öffentlich/intern (wie `DocumentArea`).
  Mitglieder sähen ein falsches PDF weiter; ein echter Rückzug bliebe nur über
  Löschen möglich, und die Historie ginge dabei verloren.
- **Verworfen:** Nur aus den Listen entfernen, Datei-URL weiter ausliefern
  („unlisted“). Billiger, aber der Rückzug wäre kosmetisch: verschickte Links und
  Suchmaschinen-Treffer lieferten das zurückgezogene PDF weiter aus.

## Consequences

- `CONTEXT.md` beschrieb „für alle Besucher sichtbar, auch ohne Login“ bisher als
  **Wesenseigenschaft** der Ausschreibung. Das ist ab jetzt nur noch der Default;
  der Glossareintrag ist entsprechend angepasst.
- Die öffentliche Datei-Route filtert auf die Stufe. Damit ein Administrator ein PDF
  vor dem Freischalten prüfen und ein zurückgezogenes noch einsehen kann, gibt es
  `GET /api/admin/ausschreibungen/[id]/file`. Die Sicherheitsgrenze aus ADR-0001 gilt
  dort unverändert: nur Dateien, die über einen Datensatz referenziert sind.
- Die Datei-Route cacht kürzer als die Listen-Antwort (`max-age=0, s-maxage=30,
  must-revalidate` statt 60/300 mit `stale-while-revalidate`), nicht öffentliche
  Dateien gar nicht. Sonst fiele ein zurückgezogenes PDF noch minutenlang aus Caches.
  Die Listen-Antwort behält ihre Cache-Dauer — ein Eintrag, der ein paar Minuten
  nachhängt, ist unkritisch, das ausgelieferte PDF nicht.
- Es gibt **keine** Ersteller-Ausnahme wie bei `lib/event-visibility.ts` (dort sieht
  der Ersteller seine eigenen ausgeblendeten Termine). Ausschreibungen werden
  ausschließlich von Administratoren verwaltet, die untereinander alles sehen; ein
  `createdById` am Modell wäre Aufwand ohne Wirkung.
- Die Achse Sichtbarkeit ist **orthogonal** zu aktuell/historisch aus ADR-0001. Eine
  historische Ausschreibung kann verborgen werden und verschwindet dann auch aus dem
  Archiv; das Ablaufdatum bleibt allein für aktuell/historisch zuständig.
- Nachtrag (Kalender, 19.10.2026): Das Enum heißt jetzt gemeinsam `Visibility` und gilt
  auch für den Termin (`Event.visibility` ersetzt `Event.visible`). Beschriftungen und
  Lese-Regel stehen zentral in `lib/visibility.ts`. Abweichend von der Ausschreibung führt
  ein anonymer Aufruf eines Termins „Nur für Mitglieder“ zum Login statt zu 404.
