# 02 — Fremdtermine im Adminbereich verwalten

Status: done

**What to build:** Administratoren pflegen [[Fremdtermin]]e unter `/admin/fremdtermine`;
Prüfer lesen. Modell `ExternalEvent` laut PRD-Abschnitt „Fremdtermin“, inkl. gemeinsamem
Zeitmodell (von–bis, ganztägig oder mit Uhrzeit), [[Fremdtermin-Art]], [[Sichtbarkeitsstufe]]
(Default MEMBER) und optionaler Verknüpfung mit einer [[Ausschreibung]].

**Blocked by:** 01 (Enum `Visibility`).

- [x] Schema + Migration `ExternalEvent` (+ Enum `ExternalEventKind`), FKs SetNull;
      `MIGRATIONS.md`.
- [x] Gemeinsame, wiederverwendbare Validierung des Zeitmodells (auch für 03):
      Ende ≥ Start; ohne Ganztag beide Uhrzeiten Pflicht (`HH:MM`); am selben Tag Ende > Beginn.
- [x] zod-Schema; `url` nur http/https; Längengrenzen analog bestehender Felder.
- [x] API `/api/admin/fremdtermine` (+`[id]`): GET read (Prüfer), POST/PUT/DELETE write, CSRF.
- [x] Seite `/admin/fremdtermine` (kommende zuerst, vergangene darunter), Modal-Formular als
      **wiederverwendbare Komponente** (Kalender-Schnellanlage in 05), Kachel im Dashboard,
      Prüfer ohne Schreibknöpfe.
- [x] Deutsche Beschriftungen der Arten zentral (RDL, RK-Veranstaltung, Wettkampf, Sonstiges).
- [x] Tests: Validierung (unit), Rechte + CRUD (integration), Seite (unit).
