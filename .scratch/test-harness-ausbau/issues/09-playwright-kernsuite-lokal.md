# 09 — Playwright-Kernsuite (lokal, kein Deploy-Gate)

Status: done

**What to build:** Eine kleine Browser-Testsuite (Playwright) mit 5–8 Tests gegen den
lokal gestarteten Production-Build. Sie läuft **manuell/lokal** über `pnpm test:e2e`
und ist bewusst **kein** Deploy-Gate (keine Browser-Binaries und keine zusätzliche
Laufzeit auf dem VPS-Deploy-Pfad).

Umfang (Kernklickpfade):

1. Öffentliche Seiten rendern ohne Konsolen-Fehler: Startseite, `/termine`,
   `/ausschreibungen`, `/news`.
2. [[Login]] mit Seed-Benutzer gelingt; falsches Passwort zeigt Fehlermeldung.
3. [[Teilnahmeanmeldung]]: eingeloggtes [[Mitglied]] meldet sich zu einem [[Termin]]
   an (Ja), sieht die eigene Anmeldung und zieht sie zurück.
4. Admin legt einen Termin an; er erscheint in der öffentlichen Liste.
5. [[Umfrage]]: Mitglied stimmt in einer Live-Umfrage ab und sieht das Ergebnis.

Rahmenbedingungen:

- Setup startet `next start` gegen eine frische, geseedete Wegwerf-SQLite
  (Seed-Benutzer je [[Rolle]] über `prisma/seed.ts` bzw. eigene E2E-Fixtures);
  niemals gegen `data/prod.db` oder `dev.db`.
- Playwright-Abhängigkeiten als `devDependencies`; Browser-Installation wird nicht
  vom normalen `pnpm install` erzwungen (eigener Schritt, z. B.
  `pnpm exec playwright install chromium`).
- Nur Chromium in der ersten Ausbaustufe.
- `README.md`/AGENTS.md beschreiben Start und Zweck (lokal, manuell, kein Gate).

**Blocked by:** None — unabhängig; sinnvoll als letztes Paket (Reihenfolge im PRD).

- [x] `pnpm test:e2e` baut nicht auf einer laufenden Dev-Instanz auf, sondern
      startet und stoppt die App selbst (Production-Build, Wegwerf-DB).
- [x] Die fünf Kernklickpfade oben sind abgedeckt; die Suite bleibt bei 5–8 Tests.
- [x] Ein kompletter Lauf bleibt lokal unter ~2 Minuten.
- [x] `pnpm test`, `deploy.sh` und `pnpm lint` bleiben von Playwright unberührt.
