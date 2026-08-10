# 04 — Integrationstests: Auth- und Token-Flüsse

Status: done

**What to build:** Integrationstests (Schicht aus Issue 03) für die drei tokenbasierten
Flüsse, deren Sicherheit an echten DB-Zuständen hängt — Befristung, Einmaligkeit,
Unique-Constraints:

- **[[Login]]:** korrektes Passwort → Session-Daten; falsches Passwort, unbekannte
  E-Mail, deaktivierte Konten → Ablehnung. Rate-Limit-Verhalten auf der echten Route.
- **[[Passwort zurücksetzen]]:** Anforderung legt echten `PasswordReset`-Datensatz an;
  Token ist genau **einmal** verwendbar (zweite Verwendung scheitert), abgelaufene
  Token scheitern, das Passwort ist danach tatsächlich geändert (Login mit neuem
  Passwort gegen die echte DB).
- **[[Einladung]]:** Einlösung legt den [[Benutzer]] wirklich an; abgelaufene und
  bereits eingelöste Einladungen scheitern; pro E-Mail nur eine aktive Einladung
  (echter Constraint, vgl. `__tests__/unique-active-invitation.test.ts` als
  Mock-Pendant); Serverregeln für Name/Adresse/Telefon gelten wie in den übrigen
  Benutzer-APIs (Confirmed requirement in AGENTS.md).

**Blocked by:** 03 — braucht die Integrations-Infrastruktur.

- [x] Jeder der drei Flüsse hat Erfolgs- und Fehlerpfade gegen die echte SQLite.
- [x] Token-Einmaligkeit und -Befristung werden über echte Datensätze geprüft, nicht
      über gemockte Rückgaben.
- [x] Nach Passwort-Reset und Einladungseinlösung wird der Endzustand aus der
      Datenbank gelesen (nicht aus der API-Antwort abgeleitet).
