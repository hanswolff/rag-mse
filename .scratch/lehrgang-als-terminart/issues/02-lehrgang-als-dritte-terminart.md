# 02 — Lehrgang als dritte Terminart

Status: done

**What to build:** Ein Administrator kann einen [[Termin]] als **Lehrgang** einordnen —
die dritte [[Terminart]] neben Training und Wettkampf. Der Lehrgang wird gespeichert,
überall mit einem eigenen Kennzeichen in Marken-Gold dargestellt und ist wie jeder Termin
öffentlich sichtbar. Damit ist der auslösende Anwendungsfall abgedeckt: der vom Verein
gebuchte Kurs mit Frank Thiel (Baltic Shooters).

Fachlich ist ein Lehrgang die angeleitete Vermittlung von Wissen oder Können,
typischerweise mit gebuchtem Referenten. Mit der dritten Art wird **Training** unscharf,
weil ein Kurs umgangssprachlich ebenfalls Training ist — das Glossar muss die Grenze
deshalb ausdrücklich ziehen: Training ist der regelmäßige eigene Übungsbetrieb **ohne
externe Anleitung**.

Die Terminart bleibt bewusst ein nullbares Freitextfeld mit deutschen Werten. Eine
Umstellung auf ein Enum ist ausdrücklich nicht Teil dieses Tickets — es ist **keine
Datenbankmigration** nötig.

**Blocked by:** 01 — Terminart zentral beschriften und einfärben. Ohne die gemeinsame
Farbzuordnung erschiene der Lehrgang stillschweigend in der Wettkampf-Farbe.

- [x] Im Termin-Formular ist „Lehrgang“ als dritte Terminart auswählbar und wird
      gespeichert.
- [x] Die serverseitige Validierung akzeptiert „Lehrgang“ und lehnt unbekannte
      Terminarten weiterhin ab.
- [x] Ein Lehrgang trägt in Terminliste, Admin-Terminliste und Detailseite ein Kennzeichen
      in Marken-Gold (helle goldene Fläche, dunkelgoldene Schrift) und ist damit von
      Training und Wettkampf unterscheidbar.
- [x] Ein Lehrgang ist ohne Login sichtbar und verhält sich bei Anmeldung, Ausblenden und
      Erinnerung wie jeder andere Termin.
- [x] `CONTEXT.md`: Die Terminart umfasst Training, Wettkampf und Lehrgang; Training ist
      als regelmäßiger eigener Übungsbetrieb ohne externe Anleitung geschärft; Lehrgang
      ist definiert und gegen die [[Ausschreibung]] abgegrenzt (dort richtet ein Dritter
      aus und die Anmeldung läuft außerhalb der Webseite).
- [x] `README.md` nennt die drei Terminarten statt zwei.
