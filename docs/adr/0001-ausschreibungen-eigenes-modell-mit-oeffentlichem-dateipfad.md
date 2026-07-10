# Ausschreibungen als eigenes Modell mit öffentlichem Datei-Auslieferungspfad

Ausschreibungen müssen für alle Besucher ohne Login sichtbar sein und ein
Ablauf-/Historie-Konzept haben — beides gibt es beim bestehenden `Document`-Modell
nicht, das jede Datei ausschließlich hinter Login ausliefert und weder öffentliche
Sichtbarkeit noch ein Ablaufdatum kennt. Wir modellieren `Ausschreibung` deshalb als
**eigenständiges Prisma-Modell** mit eigenem, separatem Speicherort
(`data/ausschreibungen/`, per `AUSSCHREIBUNGEN_DIR` konfigurierbar, nicht in Git) und
einem **dedizierten, nicht authentifizierten** Datei-Endpunkt, der ausschließlich
Dateien ausliefert, die zu einer existierenden Ausschreibung gehören.

## Considered Options

- **Gewählt:** Eigenes Modell + eigener öffentlicher Pfad. Klare Trennung; die
  auth-gegateten Dokumente-Pfade und deren Sicherheitsannahmen bleiben unberührt.
- **Verworfen:** `Document` um `DocumentArea.PUBLIC` und `expiresAt` erweitern.
  Weniger neuer Code, aber es hätte öffentlichen, unauthentifizierten Zugriff und
  Ablauf-Logik in Codepfade gezwungen, die bisher „jede Datei ist geschützt"
  voraussetzen — ein riskanter Umbau einer sicherheitskritischen Annahme.

## Consequences

- Es existiert erstmals ein öffentlicher Datei-Auslieferungspfad. Sicherheitsgrenze:
  Er darf niemals beliebige Speichernamen ausliefern, sondern nur Dateien, die über
  einen Ausschreibungs-Datensatz referenziert sind.
- Aktuell vs. historisch ergibt sich rein rechnerisch aus dem Ablaufdatum
  (siehe [CONTEXT.md](../../CONTEXT.md)); kein Statusfeld, kein Cronjob.
