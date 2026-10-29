# 05 — Abwesenheiten und Fremdtermine im Kalender eintragen

Status: done

**What to build:** Im Kalender tragen eingeloggte Benutzer ihre [[Abwesenheit]]en ein,
bearbeiten und löschen sie; Administratoren legen zusätzlich [[Fremdtermin]]e schnell an
(gleiche Formular-Komponente wie in 02).

**Blocked by:** 04.

- [x] Knopf „Abwesenheit eintragen“ (eingeloggt); Tages-/Zeitraumauswahl füllt das
      Formular vor (von–bis, ganztägig/Uhrzeit, Grund).
- [x] Das Abwesenheitsformular zeigt neben dem Feld „Grund“ den Hinweis aus der
      Datenschutzerklärung: keine Gesundheits- oder sonstigen sensiblen Angaben –
      „Urlaub“ oder „verhindert“ genügt.
- [x] Dialog der eigenen Abwesenheit mit Bearbeiten und Löschen (mit Bestätigung).
- [x] Knopf „Fremdtermin eintragen“ nur für Admins (nicht Prüfer), wiederverwendetes Formular.
- [x] Nach Speichern/Löschen aktualisiert sich der Kalender.
- [x] Tests: Rollen-abhängige Knöpfe, Formular-Vorbelegung, Speichern (unit).
