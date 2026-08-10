# CSP-Nonces: Stand der Umstellung

Ziel ist, `script-src 'unsafe-inline'` durch Nonces zu ersetzen. Die Mechanik steht,
läuft aber **nur als `Content-Security-Policy-Report-Only`**. Der erzwingende Header
aus `next.config.mjs` erlaubt weiterhin `'unsafe-inline'`; es kann also nichts brechen.

## Was aktuell passiert

- `proxy.ts` erzeugt je Request eine Nonce, gibt sie als Request-Header `x-nonce` und
  `Content-Security-Policy` weiter (daraus liest Next sie und setzt sie an seine
  eigenen Skripte) und sendet den Report-Only-Header mit derselben Nonce.
- `next.config.mjs` sendet unverändert den erzwingenden Header mit `'unsafe-inline'`.
- Beide Header teilen sich die Direktiven aus `lib/csp-directives.mjs`.

## Befund: statisch vorgerenderte Seiten können keine Nonce tragen

Gemessen am Produktions-Build (Server lokal gestartet, `curl`):

| Seite        | Skripte | mit Nonce |
| ------------ | ------- | --------- |
| `/`          | 22      | 21 ¹      |
| `/termine`   | 22      | 22        |
| `/news`      | 22      | 22        |
| `/ueber-uns` | 24      | **0**     |
| `/impressum` | 24      | **0**     |
| `/login`     | 23      | **0**     |

¹ Das eine Skript ohne Nonce ist der JSON-LD-Block (`type="application/ld+json"`).
Der Browser führt ihn nicht aus, `script-src` greift dafür nicht.

**Ursache:** Das HTML statischer Seiten (im Build-Log als `○ (Static)` markiert)
entsteht zur Build-Zeit — lange bevor es einen Request und damit eine Nonce gibt.
Der Report-Only-Header wird zwar mitgeschickt (die Middleware läuft), die
Skript-Tags im ausgelieferten HTML tragen aber kein `nonce`-Attribut.

**Folge, wenn heute erzwungen würde:** Auf diesen Seiten würde **kein einziges Skript**
mehr laufen. `'strict-dynamic'` setzt `'self'` außer Kraft, und sobald eine Nonce in
der Policy steht, ignorieren Browser `'unsafe-inline'`. Die Seiten blieben sichtbar,
aber ohne Menü, ohne Formularinteraktion — genau der stille Totalausfall, wegen dem
das Ticket auf `ready-for-human` stand.

## Was vor dem Erzwingen zu klären ist

1. **Statische Seiten dynamisch machen?** `export const dynamic = "force-dynamic"`
   auf jeder betroffenen Seite löst das Nonce-Problem, kostet aber genau die
   Auslieferung aus dem Cache, deretwegen sie statisch sind.
2. **Oder `'strict-dynamic'` weglassen** und `script-src 'self' 'nonce-…'` fahren.
   Externe Chunks lädt dann `'self'`; die **inline** Bootstrap-Skripte statischer
   Seiten blieben trotzdem blockiert (siehe Tabelle: `/ueber-uns` hat 10 davon).
   Löst das Problem also nicht allein.
3. **Oder beim Ist-Zustand bleiben** und die Risikolage wie im Review 2026-07-30
   bewerten: Die einzige HTML-Senke mit Benutzerinhalten läuft durch `sanitize-html`
   mit enger Allow-List, die übrigen sind JSON-LD über `serializeJsonLd`.

## Browser-Prüfung (noch offen)

Die Zahlen oben stammen aus dem ausgelieferten HTML, nicht aus einem Browser. Vor dem
Erzwingen ist zusätzlich zu prüfen, dass in der Konsole keine Verstöße auflaufen auf:
Startseite, Termin-Detail (Leaflet-Karte), Adminbereich mit Rich-Text-Editor und
PDF-Viewer (`react-pdf` startet einen Worker).

## Erzwingen

Nicht in `next.config.mjs` umstellen — `headers()` läuft zur Build-Zeit und kennt
keine Nonce. Die Umstellung findet im Proxy statt:

1. In `proxy.ts` den Header `Content-Security-Policy-Report-Only` durch
   `Content-Security-Policy` ersetzen.
2. In `next.config.mjs` den globalen `Content-Security-Policy`-Eintrag **entfernen**.
   Zwei CSP-Header werden beide erzwungen — es gilt ihre Schnittmenge. Der
   permissive Header aus der Config würde den strengen also nicht abmildern,
   sondern nur zusätzlich einschränken.
3. Beachten: Der Proxy läuft laut `config.matcher` nicht auf `/api`, `_next/static`,
   `_next/image` und Bild-/Dokumentendateien. Diese Antworten hätten nach Schritt 2
   gar keine CSP mehr; soll das nicht so sein, muss der Header dort eigens gesetzt
   werden.
4. Prefetch-Requests bekommen bewusst keine Nonce (siehe Kommentar in `proxy.ts`)
   und damit auch keinen CSP-Header. Das ist für das zwischengespeicherte HTML
   richtig, heißt aber: Der Schutz greift erst beim echten Request.

`scripts/check-csp-smoke.js` schaltet automatisch von Warnung auf Fehler um, sobald
der erzwingende Header eine Nonce führt.
