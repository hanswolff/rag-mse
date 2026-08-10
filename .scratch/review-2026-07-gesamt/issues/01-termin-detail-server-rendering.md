# Termin-Detailseite serverseitig rendern (SEO)

Status: ready-for-agent

## What to build

`app/termine/[id]/page.tsx` ist vollständig client-gerendert (`"use client"`, Daten via
`/api/events/[id]`). Der öffentliche Inhalt (Datum, Ort, Beschreibung) und das JSON-LD
fehlen dadurch im HTML — schwaches SEO ausgerechnet für den Seitentyp, den die Sitemap
bewirbt.

- Seite in eine Server-Komponente umbauen, die den öffentlichen Teil (Termin-Daten,
  Karte-Platzhalter, JSON-LD) serverseitig rendert.
- Teilnahmeanmeldung/Abstimmungs-UI als Client-Insel extrahieren (bestehende Hooks
  `use-event-voting` / `use-event-detail` weiterverwenden bzw. aufteilen).
- `generateMetadata` existiert bereits (`app/termine/[id]/metadata.ts`) und bleibt.
- Regressionstests: öffentliche Anzeige ohne Login, Teilnahmeanmeldung eingeloggt,
  Admin-Funktionen (Anmeldung hinzufügen, Termin bearbeiten) unverändert.

Herkunft: Gesamt-Review 2026-07-30, Befund F20 (bewusst zurückgestellt — halber Tag
Refactoring mit Regressionsrisiko auf der meistgenutzten Seite).
