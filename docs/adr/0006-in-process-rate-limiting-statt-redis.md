# Rate-Limiting im Anwendungsprozess statt in Redis

Die Zähler des Rate-Limiters liegen im Arbeitsspeicher des Anwendungsprozesses
(`lib/rate-limit-store.ts`). Der Store bildet die kleine Teilmenge der
Redis-String-Befehle nach, die der Rate-Limiter benutzt
(`get`/`set`/`incr`/`decr`/`del`/`pexpire`/`pttl`/`keys`), sodass die Limiter-Logik
selbst unverändert blieb. Schlüssel verfallen beim Zugriff und werden periodisch
weggeräumt.

## Considered Options

- **Gewählt: In-Process-Store.** Die Anwendung läuft als **ein** Next.js-Prozess auf
  **einem** Host mit eingebettetem SQLite und einem HAProxy-Backend. Unter dieser
  Voraussetzung sieht ein einzelner Prozess ohnehin alle Anfragen — ein externer
  Zähler brächte keine zusätzliche Genauigkeit, aber einen weiteren Dienst, der
  ausfallen, altern und gesichert werden muss.
- **Verworfen: Redis.** Vorher im Einsatz. Für eine Ein-Prozess-Bereitstellung ist es
  eine zusätzliche Fehlerquelle: Fällt Redis aus, muss die Anwendung entscheiden, ob
  sie Anfragen durchlässt oder blockiert — eine Frage, die sich ohne Redis gar nicht
  stellt.

## Consequences

- **Die Zähler sind nicht dauerhaft.** Jeder Neustart und jedes Deployment setzt alle
  Limits zurück. Das ist bewusst in Kauf genommen; ein Angreifer müsste den
  Deploy-Zeitpunkt treffen, um daraus Nutzen zu ziehen.
- **Diese Entscheidung bricht, sobald eine zweite Instanz läuft.** Zwei Prozesse
  hätten getrennte Zähler, das effektive Limit verdoppelte sich still. Wer horizontal
  skaliert — etwa im Zuge eines Blue-Green-Deploys mit zwei gleichzeitig laufenden
  Containern — muss den Store vorher durch einen gemeinsamen ersetzen.
- Das Verhalten bei einem Fehler im Limiter ist explizit geregelt
  (`shouldFailOpenOnRateLimiterError`): in Produktion standardmäßig **fail closed**,
  außerhalb der Produktion fail open, per `RATE_LIMIT_FAIL_OPEN` überschreibbar.
- Der Speicherverbrauch ist durch das periodische Aufräumen begrenzt.
