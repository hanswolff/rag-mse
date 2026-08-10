# Barrierefreiheit & Styling-Vereinheitlichung

Status: ready-for-agent

## What to build

Sammelticket aus dem Gesamt-Review 2026-07-30 (Befund F32, zurückgestellter Teil).
AGENTS.md verlangt globales Styling (Theme-Tokens, geteilte Utilities) statt
Komponenten-Sonderwegen.

### Barrierefreiheit
1. `components/rich-text-editor.tsx`: sichtbares Label zeigt auf eine `aria-hidden`
   sr-only-Textarea; das eigentliche contenteditable hat keinen zugänglichen Namen.
   Fett/Kursiv/Liste-Buttons ohne `aria-pressed`.
2. Icon-Buttons nur mit `title`: `poll-form-modal.tsx` (↑ ↓ ✕),
   `app/admin/umfragen/page.tsx` — `aria-label` ergänzen (Vorbild:
   `benutzerverwaltung`, `voting-results.tsx`).
3. `app/umfragen/[id]/page.tsx`: `role="radio"`/`role="checkbox"` auf Buttons ohne
   Gruppen-Semantik und Pfeiltasten-Navigation; dekorative Emojis ohne `aria-hidden`.
4. `components/navigation.tsx`: sr-only-Text bleibt „Menü öffnen“ bei offenem Menü;
   `aria-controls` fehlt.

### Styling-Vereinheitlichung
5. Grüner Geocode-Button wortgleich dupliziert in `event-form-modal.tsx` und
   `range-form-modal.tsx` → gemeinsame Utility/Komponente.
6. `shooting-range-picker.tsx`: blauer Einzelfall-Button → `btn-secondary`.
7. Handgebaute Action-Buttons in `app/admin/termine/page.tsx`, `app/admin/news/page.tsx`
   → `btn-*`-Utilities.
8. Emoji-Icons (✏️ 🗑️, Dashboard-Kacheln) → SVG-Icon-System (`components/icons.tsx`).
9. `form-input` auf `<select>`-Elementen → `form-select` (event-, user-, poll-Modals,
   admin-document-manager).
10. Vollflächiger `LoadingScreen` bei jedem Refetch (document-manager, e-mail-versand,
    benachrichtigungen, admin/termine) → nur beim Erstladen (Vorbild:
    `app/mitglieder-dokumente/page.tsx`).

### Kleinkram
11. Metadata-Lücken: `passwort-zuruecksetzen/[token]` und `einladung/[token]` ohne
    eigene Titel/noindex-Metadata; tote `export const revalidate` auf dynamischen
    Seiten (termine, news).
12. `use-news-management.ts`/`news-form-modal.tsx`: „heute“-Vorbelegung wird beim
    Modullade-Zeitpunkt berechnet — Tab über Mitternacht → gestriges Datum.
13. `lib/server-error-mapper.ts`: Substring-Matching (`"Name"`, `"PK"`) ordnet
    allgemeine Meldungen falschen Feldern zu.
