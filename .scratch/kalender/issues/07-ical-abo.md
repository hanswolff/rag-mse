# 07 — Öffentliches iCal-Abo /kalender.ics

Status: done

**What to build:** Öffentlicher Feed mit allen PUBLIC-Terminen und PUBLIC-Fremdterminen
(−90 Tage bis +1 Jahr). Siehe PRD „iCal-Abo“.

**Blocked by:** 01, 02.

- [x] Feed-Builder in `lib/calendar.ts` (mehrere VEVENTs, Escaping, Zeilenfaltung,
      Zeitzone Europe/Berlin korrekt, ganztägig `VALUE=DATE` mit exklusivem DTEND, stabile
      UIDs); `buildCalendarEvent` unverändert.
- [x] Route `/kalender.ics`, `text/calendar; charset=utf-8`, öffentliche Cache-Header.
- [x] Link „Kalender abonnieren“ (https + webcal) auf `/kalender`.
- [x] Tests: Feed-Builder (unit), Route enthält nur PUBLIC (integration).
