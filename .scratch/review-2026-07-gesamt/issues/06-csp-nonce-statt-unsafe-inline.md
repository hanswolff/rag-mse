# CSP: `script-src 'unsafe-inline'` durch Nonces ersetzen

Status: ready-for-human

Offen ist nur noch eine Entscheidung, keine Implementierung: Wie mit den statisch
vorgerenderten Seiten umgegangen wird (drei Optionen samt Kosten in
`docs/CSP_NONCE_ROLLOUT.md`) und die Browser-Verifikation aus Schritt 4.

## What to build

`next.config.mjs` erlaubt in Produktion `script-src 'unsafe-inline'`. Damit fehlt die
letzte Verteidigungslinie hinter den HTML-Senken der App — insbesondere
`app/termine/[id]/page.tsx:154`, das von Administratoren verfasste
Termin-Beschreibungen über `dangerouslySetInnerHTML` rendert.

Aktuelle Risikolage (bewusst als vertretbar eingestuft, Review 2026-07-30):
- Die einzige HTML-Senke mit Benutzerinhalten läuft durch `sanitize-html` mit enger
  Allow-List (`lib/event-description.ts:5-23`, kein `script`, kein `on*`, `rel` erzwungen).
- Die drei übrigen `dangerouslySetInnerHTML`-Stellen sind JSON-LD über
  `serializeJsonLd`, das `<`, `>`, `&`, U+2028/9 escaped.
- Inhalte stammen ausschließlich von Administratoren, nicht von anonymen Besuchern.

## Umsetzung

1. Nonce je Request in `proxy.ts` erzeugen und als Request-Header weiterreichen.
2. Nonce in `app/layout.tsx` auslesen und an alle Inline-Skripte (inkl. der von Next
   selbst erzeugten Bootstrap-Skripte, `nonce`-Prop bzw. `unstable_` Mechanismen der
   verwendeten Next-Version) durchreichen.
3. `'unsafe-inline'` aus `script-src` entfernen, `'nonce-<value>'` setzen; `style-src`
   getrennt bewerten (Tailwind/inline styles).
4. Verifikation im Browser: Startseite, Termin-Detail (Karte/Leaflet), Admin-Bereich mit
   Rich-Text-Editor und PDF-Viewer (react-pdf nutzt Worker) — CSP-Verstöße in der
   Konsole müssen leer bleiben.
5. `scripts/check-csp-smoke.js` und `__tests__/next-config.test.ts` entsprechend
   erweitern.

Grund für „ready-for-human“: Ohne Browser-Verifikation ist ein stiller Totalausfall der
Client-Interaktivität wahrscheinlich; der Deploy-Smoke-Test prüft nur den Header, nicht
die Funktion.

## Comments

### 2026-08-04 — Umsetzung als Report-Only (abgestimmt)

Die Nonce-Mechanik ist umgesetzt (Schritte 1, 2, 5), wird aber bewusst **nur als
`Content-Security-Policy-Report-Only`** ausgeliefert. Der erzwingende Header aus
`next.config.mjs` behält `'unsafe-inline'`; es kann nichts brechen. Schritt 3
(`'unsafe-inline'` entfernen) steht deshalb noch aus, Schritt 4 (Browser-Prüfung)
ebenfalls — hier war kein Browser verfügbar.

**Wesentlicher Befund:** Statisch vorgerenderte Seiten können keine Nonce tragen. Am
Produktions-Build gemessen (Server lokal gestartet, `curl`):

| Seite | Skripte | mit Nonce |
| --- | --- | --- |
| `/`, `/termine`, `/news` (dynamisch) | 22 | 21–22 |
| `/ueber-uns`, `/impressum`, `/login` (statisch) | 23–24 | **0** |

Ihr HTML entsteht zur Build-Zeit, lange vor dem Request. Würde heute erzwungen, liefe
auf diesen Seiten **kein einziges Skript** mehr — `'strict-dynamic'` setzt `'self'`
außer Kraft, und eine Nonce in der Policy lässt Browser `'unsafe-inline'` ignorieren.
Genau der stille Totalausfall, wegen dem das Ticket auf `ready-for-human` stand; er ist
damit ohne Browser reproduzierbar nachgewiesen.

Die verbleibende Entscheidung (statische Seiten dynamisch machen, `'strict-dynamic'`
weglassen, oder beim Ist-Zustand bleiben) ist samt Konsequenzen in
`docs/CSP_NONCE_ROLLOUT.md` festgehalten.

`scripts/check-csp-smoke.js` meldet fehlende Nonces in der Report-Only-Phase als
**Warnung** und schaltet automatisch auf **Fehler** um, sobald der erzwingende Header
eine Nonce führt — das Deployment rollt dadurch jetzt nicht fälschlich zurück.

### 2026-08-04 — Review-Korrekturen

- **Prefetch-Requests umgingen den Auth-Schutz.** Der Matcher schloss sie über
  `missing:` komplett aus (aus dem Next-CSP-Beispiel übernommen), womit
  `<Link>`-Prefetches auf `/admin` den Proxy gar nicht mehr durchliefen. Der
  Adminbereich ist zwar zusätzlich serverseitig geschützt (`app/admin/layout.tsx`),
  aber die Tiefenverteidigung fehlte. Jetzt läuft der Proxy auch für Prefetches und
  lässt nur die **Nonce** weg — die wäre in zwischengespeichertem HTML ohnehin
  wertlos. Im laufenden Server gegengeprüft: Prefetch auf `/admin/termine` → 307.
- **`PROTECTED_PREFIXES` doppelte die Liste aus `shouldRedirectToLogin`.** Beide leiten
  sich jetzt aus `LOGIN_REQUIRED_PREFIXES` in `lib/auth-utils.ts` ab.
- **Schritt 5 war nur halb erledigt:** `__tests__/next-config.test.ts` ist jetzt
  ergänzt — der erzwingende Header darf keine Nonce und kein `'strict-dynamic'`
  führen, und er muss aus derselben Direktiven-Quelle stammen wie der Report-Only-Header.
- Der Kommentar zu `getNonceScriptSrc` behauptete, `'unsafe-inline'` sei ein Rückfall
  für Browser ohne Nonce-Unterstützung. Richtig ist: `'strict-dynamic'` setzt in
  CSP3-fähigen Browsern `'self'`, `'unsafe-inline'` **und** Host-Einträge außer Kraft.
  Genau daraus folgt der Befund zu den statischen Seiten. `https://unpkg.com` ist unter
  der Nonce-Policy wirkungslos und dort entfernt.
- Die CSP-Direktiven werden pro Request nur noch einmal gebaut statt zweimal.
