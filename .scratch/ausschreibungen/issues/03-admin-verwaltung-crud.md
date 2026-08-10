# Admin-Verwaltung für Ausschreibungen (CRUD)

Status: done

## What to build

Ein Verwaltungsbereich unter `/admin/ausschreibungen`, mit dem Administratoren
Ausschreibungen anlegen, bearbeiten und löschen können — analog zur bestehenden
Dokumente-Verwaltung, aber als flache Liste ohne Verzeichnisse.

Umfang:

- Seite `/admin/ausschreibungen` mit Liste aller Ausschreibungen (aktuell und
  historisch) und zugehörigen authentifizierten Admin-Endpunkten.
- Anlegen: Titel (Pflicht), Beschreibung (optionaler Freitext), Ablaufdatum,
  PDF-Upload. Beim Ablaufdatum wird als Vorschlag/Default-Hinweis das
  Veranstaltungsdatum genannt; der Wert ist frei wählbar.
- Bearbeiten: alle Felder änderbar, inklusive Ersetzen der PDF.
- Löschen: entfernt Datensatz und Datei endgültig (auch aus der Historie).
- Nur PDF als Dateityp.
- Rollen (gemäß `docs/ROLLEN_RECHTE_SPEZIFIKATION.md`): `ADMIN` und
  `SITE_ADMINISTRATOR` dürfen schreiben (anlegen/bearbeiten/löschen); `AUDITOR` hat
  ausschließlich Lesezugriff. Berechtigungen serverseitig durchsetzen.

## Acceptance criteria

- [x] ADMIN/SITE_ADMINISTRATOR können unter `/admin/ausschreibungen` eine Ausschreibung mit Titel, Beschreibung, Ablaufdatum und PDF anlegen.
- [x] Eine neu angelegte Ausschreibung erscheint anschließend öffentlich unter `/ausschreibungen`.
- [x] Bearbeiten ist möglich, inklusive Ersetzen der PDF; die alte Datei wird dabei nicht verwaist im Speicher belassen.
- [x] Löschen entfernt Datensatz und Datei endgültig, auch wenn die Ausschreibung bereits historisch ist.
- [x] Nur PDF-Uploads werden akzeptiert; andere Dateitypen werden abgelehnt.
- [x] AUDITOR kann die Liste sehen, aber keine schreibenden Aktionen ausführen; Schreib-Endpunkte weisen AUDITOR serverseitig ab.
- [x] Das Ablaufdatum-Feld zeigt einen Hinweis, dass üblicherweise das Veranstaltungsdatum gemeint ist.

## Blocked by

- `.scratch/ausschreibungen/issues/01-datenmodell-und-oeffentliche-anzeige.md`
