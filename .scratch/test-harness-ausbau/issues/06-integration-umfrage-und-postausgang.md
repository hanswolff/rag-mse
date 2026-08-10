# 06 — Integrationstests: Umfrage und Postausgang

Status: done

**What to build:** Integrationstests (Schicht aus Issue 03) für den Zustandsautomaten
der [[Umfrage]] und die Warteschlangen-Mechanik des [[Postausgang]]s:

- **Umfrage:** Zustände Entwurf → Live → Geschlossen gegen die echte DB. Abstimmen
  ([[Stimme]]) gelingt nur bei **Live**; bei Entwurf und Geschlossen wird abgelehnt.
  Mehrfachauswahl gemäß Umfrage-Einstellung; eine erneute Stimmabgabe desselben
  [[Benutzer]]s ersetzt die alte statt sie zu doppeln (echter DB-Zustand). Kurzlink
  `/u/<code>` löst auf die richtige Umfrage auf.
- **Postausgang:** Einreihen erzeugt echte `OutgoingEmail`-Datensätze; der
  Versand-Worker verarbeitet sie gegen die echte DB (SMTP gemockt — nur der
  Transport, nicht die Queue). Fehlgeschlagene Sendeversuche werden innerhalb des
  Zeitfensters erneut versucht; nach Ausschöpfung bleibt der Status „dauerhaft
  fehlgeschlagen“ und ein Admin kann manuell neu einplanen. „Versendet“ heißt: an
  den Mail-Server übergeben (Statusübergänge real in der DB prüfen).

**Blocked by:** 03 — braucht die Integrations-Infrastruktur.

- [x] Stimmabgabe in jedem der drei Umfrage-Zustände verhält sich wie beschrieben;
      der Endzustand wird aus der Datenbank gelesen.
- [x] Erneutes Abstimmen erzeugt keine Duplikate (echter DB-Zustand).
- [x] Retry-Fenster und manuelles Neuplanen erzeugen die erwarteten
      Statusübergänge an echten `OutgoingEmail`-Datensätzen.
- [x] Nur der SMTP-Transport ist gemockt; Queue, Status und Zeitfenster laufen real.
