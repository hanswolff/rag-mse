# Menü „Infos“ neu gruppieren inkl. Ausschreibungen

Status: done

## What to build

Das „Infos“-Dropdown wird neu gruppiert, sodass die häufig genutzten bzw. neuen
Einträge oben stehen und der Rest darunter — mit einem sinnvollen Separator.

Zielreihenfolge (Desktop und Mobile identisch):

- Obere Gruppe: **Ausschreibungen**, **Formulare**, **Dokumente für Mitglieder**
  (letzteres nur für eingeloggte Mitglieder sichtbar, wie bisher)
- Separator
- Untere Gruppe: die restlichen Info-Seiten (Schießsportordnung, Leitfaden
  Waffenteile, Waffentechnische Begriffe, Sachkundeprüfung, Sicherheitsbelehrung)

„Ausschreibungen“ verlinkt auf die öffentliche Seite `/ausschreibungen` und ist für
alle Besucher sichtbar (auch ohne Login).

## Acceptance criteria

- [x] Im „Infos“-Menü stehen oben Ausschreibungen und Formulare, gefolgt von „Dokumente für Mitglieder“ (nur eingeloggt).
- [x] Danach folgt ein Separator und darunter die übrigen Info-Seiten.
- [x] „Ausschreibungen“ ist für nicht eingeloggte Besucher sichtbar und verlinkt auf `/ausschreibungen`.
- [x] Reihenfolge und Gruppierung sind auf Desktop und Mobile konsistent.

## Blocked by

- `.scratch/ausschreibungen/issues/01-datenmodell-und-oeffentliche-anzeige.md` (das Link-Ziel `/ausschreibungen` muss existieren)
