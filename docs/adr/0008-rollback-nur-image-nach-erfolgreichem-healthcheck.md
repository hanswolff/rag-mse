# Rollback stellt die Datenbank nur zurück, solange der neue Stand nie healthy war

`deploy.sh` legt unmittelbar vor dem Container-Neustart ein Backup der Datenbank an und
kennt beim Rollback zwei Modi:

- **`with-db-restore`** — Image **und** Datenbank zurück. Nur zulässig, solange der
  neue Container **nie** den Zustand `healthy` erreicht hat.
- **`image-only`** — nur das vorherige Image, die Datenbank bleibt unangetastet. Gilt
  ab dem Moment, in dem der neue Stand einmal healthy war.

## Considered Options

- **Gewählt: Restore nur vor dem ersten Healthy.** Vor dem ersten erfolgreichen
  Healthcheck hat kein Benutzer den neuen Stand erreicht; zwischen Backup und Rollback
  kann es keine angenommene Benutzeraktion geben. Das Zurückspielen ist dann
  verlustfrei. Danach ist es das nicht mehr.
- **Verworfen: immer auch die Datenbank zurückspielen.** Ein Rollback nach einem
  Fehler, der erst im Betrieb auffällt, würde jede seit dem Deploy angenommene
  Anmeldung, Umfragestimme und Profiländerung stillschweigend verwerfen — ein
  Datenverlust, den niemand bemerkt, weil die Seite danach funktioniert.
- **Verworfen: nie zurückspielen.** Schlägt eine Migration mittendrin fehl, bliebe eine
  halb migrierte Datenbank zurück, die auch das alte Image nicht mehr starten kann.

## Consequences

- Eine fehlerhafte Migration, die erst nach dem ersten Healthy auffällt, ist **nicht**
  automatisch rückholbar. Der Weg zurück ist dann eine Vorwärts-Migration oder ein
  bewusster manueller Restore mit Datenverlust — die Fundstelle des Backups wird beim
  Rollback deshalb ins Log geschrieben.
- Migrationen müssen abwärtsverträglich genug sein, dass das vorherige Image mit dem
  neuen Schema noch startet. Zusätzliche nullbare Spalten erfüllen das; Umbenennungen
  und Löschungen nicht.
- Schlägt auch der Rollback fehl, endet das Skript mit einem ausdrücklichen Hinweis auf
  nötige Handarbeit statt mit einem stillen Teilzustand.
