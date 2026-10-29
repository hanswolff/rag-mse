# Fremdtermin und Abwesenheit sind eigene Modelle, keine Varianten des Termins

Der [[Kalender]] zeigt drei Arten von Einträgen: [[Termin]]e des Vereins,
[[Fremdtermin]]e Dritter und [[Abwesenheit]]en von Benutzern. Wir bilden Fremdtermin
(`ExternalEvent`) und Abwesenheit (`Absence`) als **eigene Prisma-Modelle** ab, statt
das bestehende Modell `Event` um eine Eintragsart zu erweitern. Der Kalender ist eine
reine Sicht, die die drei Quellen zusammenführt; er hat kein eigenes Modell.

Wer `Event`, `ExternalEvent` und `Absence` nebeneinander sieht, fragt sich, warum das
nicht eine Tabelle mit einem Typfeld ist — deshalb ist die Entscheidung hier festgehalten.

## Considered Options

- **Gewählt: drei getrennte Modelle, vereint nur in der Kalender-Sicht.** Die drei
  Einträge unterscheiden sich in fast allem, was zählt: Nur der Termin hat
  [[Teilnahmeanmeldung]], [[Termin-Erinnerung]], [[Umfrage]]n, Karte und
  [[Belegung]]. Fremdtermin und Abwesenheit sind mehrtägig und ganztägig möglich, der
  Termin bleibt bewusst ein Tag mit Uhrzeit. Die Abwesenheit ist personenbezogen, gehört
  einem Benutzer, ist nur für Ersteller, Administratoren und Prüfer sichtbar und wird
  nach Ablauf automatisch gelöscht. Getrennte Modelle halten diese Regeln an je einer
  Stelle und lassen den gut getesteten Termin-Code unberührt.
- **Verworfen: `Event` mit Typfeld (Termin/Fremdtermin/Abwesenheit).** Jede bestehende
  Abfrage auf `Event` (öffentliche API, Sitemap, Erinnerungen, Teilnahmeanmeldung,
  Umfragen) müsste künftig Fremdtermine und Abwesenheiten ausfiltern; ein vergessener
  Filter würde private Abwesenheiten öffentlich machen oder Erinnerungen für
  Fremdtermine verschicken. Dazu kämen viele nur teilweise gültige Spalten.
- **Verworfen: Abwesenheit als Termin mit Sichtbarkeitsstufe „Verborgen“.** Vermischt eine
  persönliche Nichtverfügbarkeit mit einem Vereinsereignis und hebelt die
  Löschfrist für personenbezogene Daten aus.

## Consequences

- Neue Eintragsarten im Kalender kommen als eigene Quelle in die Kalender-Sicht, nicht
  als Typ in `Event`.
- Die [[Kollision]] wird über die drei Quellen hinweg berechnet und ist reine Logik
  ohne gespeicherten Zustand.
- Würde der Termin später mehrtägig, bleibt er trotzdem ein eigenes Modell; nur das
  Zeitmodell würde angeglichen.
