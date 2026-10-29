# 06 — Kollisionen markieren und im Termin-Formular anzeigen

Status: done

**What to build:** [[Kollision]] = ein Termin berührt denselben Kalendertag wie ein anderer
Termin, ein Fremdtermin oder eine Abwesenheit. Reine Funktion in `lib/`, Markierung im
Kalender und nicht-blockierender Hinweis im Termin-Formular — nur Admins und Prüfer.
Siehe PRD „Kollision“.

**Blocked by:** 04.

- [x] Reine Kollisionsfunktion inkl. Unit-Tests (mehrtägig, ganztägig, Tagesgrenzen,
      eigener Termin ausgenommen, Tag ohne Termin ist keine Kollision).
- [x] Kalender-API liefert Kollisionstage nur für Admin/Prüfer; Kalender markiert sie.
- [x] `GET /api/admin/kollisionen?datum&ohneTermin` (`requireAdmin("read")`).
- [x] Termin-Formular zeigt `AlertBox type="warning"` mit den kollidierenden Einträgen, sobald
      ein Datum gewählt ist; Speichern bleibt immer möglich.
- [x] Tests: Endpunkt je Rolle (integration), Hinweis im Formular (unit).
