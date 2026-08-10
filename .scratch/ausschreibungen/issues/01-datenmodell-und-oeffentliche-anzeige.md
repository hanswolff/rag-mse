# Datenmodell + öffentliche Anzeige von Ausschreibungen (aktuell & Archiv)

Status: done

## What to build

Der erste End-to-End-Durchstich für das Feature „Ausschreibungen“ (siehe
`CONTEXT.md` für die Begriffe und `docs/adr/0001-…md` für die Modell-/Public-Path-
Entscheidung).

Eine Ausschreibung ist eine öffentlich einsehbare Bekanntmachung eines externen
Wettbewerbs (z. B. Landesmeisterschaft) mit einer PDF, einem Titel, einer optionalen
Freitext-Beschreibung und einem Ablaufdatum („Anzeigen bis“). Sie ist eine
eigenständige Entität, technisch getrennt vom bestehenden `Document`-Modell.

Diese Slice liefert: das Datenmodell, die separate Dateiablage, den öffentlichen
Lesepfad und die öffentliche Seite `/ausschreibungen` — inklusive der Aufteilung in
aktuelle und historische (abgelaufene) Ausschreibungen. Damit die Seite sofort
demonstrierbar ist, wird die bereits abgelegte Landesmeisterschafts-PDF per
idempotentem Seed als Datensatz übernommen.

Umfang:

- Prisma-Modell `Ausschreibung` (Titel, optionale Beschreibung als reiner Freitext,
  Ablaufdatum, Datei-Metadaten analog `Document`) + Migration.
- Eigener Speicherort für die Dateien, getrennt von den Dokumenten, per Umgebungs-
  variable konfigurierbar und nicht in Git eingecheckt (analog zum bestehenden
  Dokumente-Speicher).
- Öffentliche, nicht authentifizierte Lese-Endpunkte: Liste der Ausschreibungen sowie
  Auslieferung der zugehörigen PDF. Der Datei-Endpunkt liefert ausschließlich Dateien
  aus, die zu einer existierenden Ausschreibung gehören — niemals beliebige
  Speichernamen.
- Öffentliche Seite `/ausschreibungen`: aktuelle Ausschreibungen prominent oben,
  darunter ein aufklappbares „Frühere Ausschreibungen“ (Archiv). PDF im vorhandenen
  Viewer ansehbar und herunterladbar.
- Aktuell vs. historisch ergibt sich rein rechnerisch aus dem Ablaufdatum, ohne
  Statusfeld und ohne Cronjob: eine Ausschreibung ist **bis einschließlich** des
  Ablauftags aktuell und **ab dem Folgetag** historisch.
- Idempotenter Seed: verschiebt die vorhandene Datei
  `data/2026-08-01_Ausschreibung_Landesmeisterschaft_Schießsport.pdf` in den neuen
  Speicherort und legt (falls noch nicht vorhanden) den Datensatz an — Titel
  „Landesmeisterschaft Schießsport“, Ablaufdatum 2026-08-01.

## Acceptance criteria

- [x] Prisma-Modell `Ausschreibung` + Migration vorhanden; Beschreibung ist reiner Freitext.
- [x] Dateien werden in einem eigenen, per Env-Var konfigurierbaren Verzeichnis abgelegt, getrennt von den Dokumenten, und sind nicht in Git eingecheckt.
- [x] Ein Gast (ohne Login) kann `/ausschreibungen` öffnen und sieht die aktuellen Ausschreibungen.
- [x] Ein Gast kann die PDF einer Ausschreibung im Viewer ansehen und herunterladen.
- [x] Abgelaufene Ausschreibungen erscheinen im aufklappbaren Archiv „Frühere Ausschreibungen“, nicht unter „aktuell“.
- [x] Eine Ausschreibung, deren Ablaufdatum heute ist, gilt noch als aktuell; ab dem Folgetag als historisch (Test deckt die Grenze ab).
- [x] Der öffentliche Datei-Endpunkt liefert nur Dateien aus, die zu einer existierenden Ausschreibung gehören.
- [x] Idempotenter Seed übernimmt die vorhandene Landesmeisterschafts-PDF als Datensatz und ist bei erneutem Lauf ohne Effekt/Fehler.
- [x] Die Datei liegt nach dem Seed nicht mehr im `data/`-Wurzelverzeichnis, sondern im Ausschreibungs-Speicher.

## Blocked by

None - can start immediately
