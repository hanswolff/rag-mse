# 04 — Kalender-Seite /kalender (Lesen)

Status: done

**What to build:** Öffentliche Seite `/kalender` mit FullCalendar 6.1.22 (Monat, Woche,
Liste), die Termine, Fremdtermine und Abwesenheiten je nach Betrachter zeigt, plus
Lese-API `GET /api/kalender`. Siehe PRD „Kalender-Sicht“.

**Blocked by:** 01, 02, 03.

- [x] Pakete `@fullcalendar/{react,core,daygrid,timegrid,list,interaction}` exakt 6.1.22.
- [x] `GET /api/kalender?von&bis` (max. ~100 Tage, sonst 400): Termine/Fremdtermine nach
      Sichtbarkeitsstufe, Abwesenheiten (Mitglied: eigene; Admin/Prüfer: alle mit Name),
      anonyme Antwort cachebar, authentifizierte no-cache. Ein Mitglied erhält nie fremde
      Abwesenheiten — Integrationstest.
- [x] Seite: deutsche Lokalisierung, Wochenstart Montag, Knopf „Heute“, URL-Zustand
      `?ansicht=monat|woche|liste&datum=YYYY-MM-DD`, < 768 px Standard Liste.
- [x] Farben je Eintragsart + Legende; Terminart bzw. Fremdtermin-Art erkennbar;
      Kennzeichen für Mitglieder/Verborgen für Berechtigte; Styling über globale Tokens.
- [x] Fremde Abwesenheiten als Sammeleintrag pro Tag („4 abwesend“), Klick zeigt Liste.
- [x] Klick: Termin → Detailseite; Fremdtermin/Abwesenheit/Sammeleintrag → zugänglicher Dialog
      (Escape schließt), Fremdtermin mit Links zu Ausschreibung und URL.
- [x] Filter-Schalter je Eintragsart, gemerkt in localStorage (try/catch).
- [x] Menüpunkt „Kalender“ nach „Termine“; `/kalender` in Sitemap.
- [x] Tests: API (integration), Seite (unit, FullCalendar ggf. gemockt).

**Umsetzungsnotizen:**

- Aggregation in `lib/calendar-service.ts` (`loadCalendar`, `parseCalendarRange`); Route bleibt dünn.
  Für 06: `CalendarData` um `kollisionen` erweitern und in `loadCalendar` nur für
  Admin/Prüfer befüllen.
- Für 05: `useCalendarData(range).reload()` aktualisiert nach Speichern/Löschen;
  `CalendarEntryDialog` hat den Slot `ownAbsenceActions(absence)` (Footer) für Bearbeiten/Löschen.
- URL-Zustand per `window.history.replaceState` (von Next unterstützt, kein Server-Roundtrip,
  kein Scroll-Sprung) statt `router.replace`; `/kalender` bleibt statisch.
- Wochenansicht zeigt 07–22 Uhr und erweitert sich bei früheren/späteren Einträgen (`getSlotRange`).

