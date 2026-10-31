# PRD — Administratoren verwalten Abwesenheiten anderer Benutzer

Status: done

Begriffe: siehe `CONTEXT.md` ([[Abwesenheit]], [[Benutzer]], [[Rolle]]). Ergebnis einer
Grilling-Sitzung vom 30.10.2026; Ausgangsversion 1.8.0, Zielversion 1.8.1.

## Problem

Heute kann nur der Benutzer selbst seine [[Abwesenheit]] anlegen, ändern und löschen
(fremde ⇒ 404, auch für Admins). Meldet sich ein Mitglied z. B. telefonisch beim
Administrator ab, kann dieser die Abwesenheit nicht für ihn eintragen.

## Entscheidungen

1. **Sichtbarkeit unverändert:** Öffentlich nie; Mitglieder sehen nur eigene; ADMIN,
   SITE_ADMINISTRATOR und AUDITOR sehen alle mit Namen, Zeitraum, Grund.
2. **Schreibrecht auf fremde Abwesenheiten:** `ADMIN` und `SITE_ADMINISTRATOR`
   (= `canManageAdminArea`), neue Methode `Permissions.canManageAllAbsences`. Der Prüfer
   bleibt rein lesend (fremde schreiben ⇒ 403 bzw. wie bisher 404 bei PUT/DELETE fremder IDs).
3. **Aktionen:** Anlegen, Bearbeiten, Löschen. Beim Bearbeiten kann der Admin die
   Abwesenheit einem **anderen Benutzer zuordnen** (Verklicker korrigieren).
4. **Eigentum:** Die Abwesenheit gehört dem Benutzer, für den sie gilt (`userId`). Er darf sie
   selbst ändern und löschen, auch wenn ein Admin sie eingetragen hat.
5. **„Eingetragen von“:** neues Feld `Absence.createdById` (nullable, FK auf `User`,
   `onDelete: SetNull`). Gesetzt auf den handelnden Benutzer beim Anlegen; ändert sich bei
   Bearbeitung ohne Umhängen **nie**. Beim Umhängen durch einen Admin: hatte der bisherige
   Eigentümer sie selbst eingetragen (`createdById == userId`), wird `createdById` auf den
   handelnden Admin gesetzt (sonst sähe der neue Eigentümer „Eingetragen von <altes Mitglied>“);
   hatte ein Admin sie eingetragen (`createdById` anderer Benutzer oder `null`), bleibt
   `createdById` unverändert (Entscheidung Product Owner, 30.10.2026). Migration füllt bestehende Zeilen mit `createdById = userId`.
   Anzeige (für Eigentümer und Admins/Prüfer):
   - `createdById == userId` ⇒ kein Hinweis (selbst eingetragen)
   - `createdById` anderer Benutzer ⇒ „Eingetragen von <Name>“
   - `createdById == null` ⇒ „Eingetragen von einem Administrator“ (Admin-Konto gelöscht)
6. **Bearbeitungen durch Admins** an fremden Abwesenheiten nur im Server-Log
   (`logInfo` mit `actorId` und `userId`), kein zweites Feld.
7. **Keine E-Mail-Benachrichtigung** des Mitglieds.
8. **Limit 100 aktive Abwesenheiten** zählt beim Eigentümer (auch beim Umhängen auf den neuen
   Eigentümer). Handelt ein Admin für einen anderen, nennt die Fehlermeldung den Namen des
   Benutzers statt „Sie“.
9. **API:** bestehende Routen `/api/abwesenheiten` (POST) und `/api/abwesenheiten/[id]`
   (PUT/DELETE) erweitern — optionales Body-Feld `userId`. Kein eigener Admin-Endpunkt.
   - Nicht-Admin mit fremder `userId` ⇒ 403.
   - `userId` muss einen **aktivierten** Benutzer (`activatedAt` gesetzt) bezeichnen, sonst
     Validierungsfehler (400).
   - Admin: PUT/DELETE auf fremde IDs erlaubt; Nicht-Admin: fremde IDs weiterhin 404.
   - PUT ohne `userId` lässt den Eigentümer unverändert.
10. **UI im Kalender** (keine Benutzerverwaltungs-Ansicht):
    - Abwesenheits-Formular: für Admins (nicht Prüfer) Auswahlfeld „Benutzer“ mit allen
      aktivierten Benutzern, nach Name sortiert, vorbelegt mit dem Admin selbst bzw. dem
      Eigentümer beim Bearbeiten.
    - Tagesliste fremder Abwesenheiten: je Eintrag „Bearbeiten“ und „Löschen“ für Admins.
    - Details zeigen „Eingetragen von …“ gemäß Punkt 5.
11. **Datenschutzerklärung Abschnitt 7:** Satz ergänzen: „Auf Ihre Mitteilung hin können
    Administratoren Abwesenheiten auch für Sie eintragen, ändern oder löschen; der Eintrag
    zeigt dann, wer ihn eingetragen hat.“ Rechtsgrundlage unverändert.

## Nicht im Umfang

- Sichtbarkeit für andere Mitglieder, E-Mail-Benachrichtigung, „zuletzt geändert von“,
  Ansicht in der Benutzerverwaltung, Release-News.
