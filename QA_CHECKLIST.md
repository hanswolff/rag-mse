# Manual QA Checklist

Dieses Dokument enthält eine detaillierte Checkliste für das manuelle Testen der wichtigsten Anwendungsflüsse (Key Flows). Führen Sie diese Tests durch vor jedem Deployment und nach größeren Änderungen.

## Vorbereitung

### Testumgebung einrichten
- [ ] Frische Datenbank mit Seed-Script initialisieren: `npm run db:seed`
- [ ] Anwendung starten: `npm run dev` oder `docker-compose up`
- [ ] Browser-Cache leeren
- [ ] Test-Browser vorbereiten (Chrome/Firefox/Safari)

### Test-Benutzer vorbereiten
Standard-Admin-Credentials nach Seed:
- Email: `admin@rag-mse.de`
- Passwort: `admin123`

Für Tests zusätzliches Mitglied erstellen.

## 1. Authentifizierung

### 1.1 Login - Erfolgreich
- [ ] Navigieren Sie zur Login-Seite (`/login`)
- [ ] Geben Sie gültige Admin-Credentials ein
- [ ] Klicken Sie auf "Login"
- [ ] **Erwartet**: Weiterleitung zur Startseite oder Profil
- [ ] **Erwartet**: Session-Cookie ist gesetzt
- [ ] **Erwartet**: Login-Button ist nicht mehr sichtbar
- [ ] **Erwartet**: Benutzername/Profil ist im Header sichtbar

### 1.2 Login - Fehlgeschlagen (Falsches Passwort)
- [ ] Navigieren Sie zur Login-Seite (`/login`)
- [ ] Geben Sie gültige E-Mail, aber falsches Passwort ein
- [ ] Klicken Sie auf "Login"
- [ ] **Erwartet**: Keine Weiterleitung
- [ ] **Erwartet**: Fehlermeldung wird angezeigt ("Ungültige Anmeldedaten")
- [ ] **Erwartet**: Keine Session wird erstellt

### 1.3 Login - Fehlgeschlagen (Nicht existierende E-Mail)
- [ ] Navigieren Sie zur Login-Seite (`/login`)
- [ ] Geben Sie nicht existierende E-Mail ein
- [ ] Klicken Sie auf "Login"
- [ ] **Erwartet**: Keine Weiterleitung
- [ ] **Erwartet**: Fehlermeldung wird angezeigt
- [ ] **Erwartet**: Keine Session wird erstellt

### 1.4 Logout
- [ ] Melden Sie sich an
- [ ] Klicken Sie auf "Logout"
- [ ] **Erwartet**: Weiterleitung zur Startseite
- [ ] **Erwartet**: Session-Cookie ist gelöscht
- [ ] **Erwartet**: Login-Button ist wieder sichtbar
- [ ] **Erwartet**: Versuch, auf geschützte Seite zuzugreifen, leitet zum Login weiter

### 1.5 Session-Persistenz
- [ ] Melden Sie sich an
- [ ] Schließen Sie den Browser (nicht den Tab)
- [ ] Öffnen Sie den Browser erneut
- [ ] Navigieren Sie zur Anwendung
- [ ] **Erwartet**: Automatisch angemeldet (Session-Cookie persistiert)
- [ ] **Erwartet**: Zugriff auf geschützte Seiten möglich

### 1.6 Session-Timeout (falls konfiguriert)
- [ ] Melden Sie sich an
- [ ] Warten Sie auf Session-Timeout (Standard: 7 Tage)
- [ ] Navigieren Sie zu einer geschützten Seite
- [ ] **Erwartet**: Weiterleitung zur Login-Seite
- [ ] **Erwartet**: Nach erfolgreichem Login zur ursprünglichen Seite weitergeleitet

### 1.7 Geschützte Routes ohne Authentifizierung
Testen Sie Zugriff auf geschützte Seiten ohne Login:
- [ ] Direkter Zugriff auf `/profil` → Weiterleitung zu `/login`
- [ ] Direkter Zugriff auf `/admin` → Weiterleitung zu `/login`
- [ ] Direkter Zugriff auf `/termine/vote` (falls vorhanden) → Weiterleitung zu `/login`

## 2. Admin - Benutzerverwaltung

### 2.1 Neuen Benutzer erstellen
- [ ] Melden Sie sich als Admin an
- [ ] Navigieren Sie zum Adminbereich (`/admin/users`)
- [ ] Klicken Sie auf "Neuen Benutzer erstellen"
- [ ] Füllen Sie alle Pflichtfelder:
  - [ ] Name: "Test Benutzer"
  - [ ] E-Mail: `test@example.com`
  - [ ] Passwort: Mindestens 6 Zeichen
  - [ ] Rolle: "MEMBER" oder "ADMIN"
- [ ] Klicken Sie auf "Speichern"
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Neuer Benutzer erscheint in der Benutzerliste
- [ ] **Erwartet**: Benutzer kann sich anmelden

### 2.2 Benutzer bearbeiten
- [ ] Melden Sie sich als Admin an
- [ ] Navigieren Sie zum Adminbereich (`/admin/users`)
- [ ] Klicken Sie auf "Bearbeiten" bei einem Testbenutzer
- [ ] Ändern Sie den Namen: "Test Benutzer Geändert"
- [ ] Ändern Sie die Rolle: "MEMBER" → "ADMIN"
- [ ] Klicken Sie auf "Speichern"
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Änderungen sind in der Benutzerliste sichtbar
- [ ] **Erwartet**: Benutzer kann sich mit neuen Rollenrechten anmelden

### 2.3 Benutzer löschen
- [ ] Melden Sie sich als Admin an
- [ ] Navigieren Sie zum Adminbereich (`/admin/users`)
- [ ] Klicken Sie auf "Löschen" bei einem Testbenutzer
- [ ] Bestätigen Sie die Löschung (falls Bestätigungsdialog)
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Benutzer ist nicht mehr in der Liste
- [ ] **Erwartet**: Benutzer kann sich nicht mehr anmelden

### 2.4 Benutzerliste und Pagination
- [ ] Melden Sie sich als Admin an
- [ ] Navigieren Sie zum Adminbereich (`/admin/users`)
- [ ] **Erwartet**: Alle Benutzer werden angezeigt
- [ ] Erstellen Sie mehr als 10 Benutzer (falls Paginierung aktiviert)
- [ ] **Erwartet**: Paginierung wird angezeigt
- [ ] **Erwartet**: Navigation zwischen Seiten funktioniert

## 3. Admin - Terminverwaltung

### 3.1 Neuen Termin erstellen
- [ ] Melden Sie sich als Admin an
- [ ] Navigieren Sie zum Adminbereich (`/admin/events`)
- [ ] Klicken Sie auf "Neuen Termin erstellen"
- [ ] Füllen Sie alle Pflichtfelder:
  - [ ] Datum: Wählen Sie ein zukünftiges Datum
  - [ ] Uhrzeit von: "14:00"
  - [ ] Uhrzeit bis: "16:00"
  - [ ] Ort: "Teststraße 123, 12345 Teststadt"
  - [ ] Beschreibung: "Testtermin für QA"
- [ ] Optional: GPS-Koordinaten eintragen (falls verfügbar)
- [ ] Klicken Sie auf "Speichern"
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Neuer Termin erscheint in der Terminliste
- [ ] **Erwartet**: Termin ist auf der öffentlichen Termine-Seite sichtbar

### 3.2 Termin bearbeiten
- [ ] Melden Sie sich als Admin an
- [ ] Navigieren Sie zum Adminbereich (`/admin/events`)
- [ ] Klicken Sie auf "Bearbeiten" bei einem Testtermin
- [ ] Ändern Sie das Datum
- [ ] Ändern Sie den Ort
- [ ] Ändern Sie die Beschreibung
- [ ] Klicken Sie auf "Speichern"
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Änderungen sind in der Terminliste sichtbar
- [ ] **Erwartet**: Geänderte Details sind auf der Termin-Detailseite sichtbar

### 3.3 Termin löschen
- [ ] Melden Sie sich als Admin an
- [ ] Navigieren Sie zum Adminbereich (`/admin/events`)
- [ ] Klicken Sie auf "Löschen" bei einem Testtermin
- [ ] Bestätigen Sie die Löschung
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Termin ist nicht mehr in der Liste
- [ ] **Erwartet**: Termin-Detailseite ist nicht mehr zugänglich (404)

### 3.4 Termin mit Karte erstellen (OpenStreetMap)
- [ ] Melden Sie sich als Admin an
- [ ] Navigieren Sie zum Adminbereich (`/admin/events`)
- [ ] Klicken Sie auf "Neuen Termin erstellen"
- [ ] Geben Sie Adresse ein: "Brandenburger Tor, Berlin"
- [ ] Optional: GPS-Koordinaten: `52.516266, 13.377775`
- [ ] Füllen Sie restliche Felder
- [ ] Speichern Sie den Termin
- [ ] Navigieren Sie zur Termin-Detailseite
- [ ] **Erwartet**: Karte wird angezeigt (OpenStreetMap/Leaflet)
- [ ] **Erwartet**: Marker an korrekter Position
- [ ] **Erwartet**: Zoom und Navigation auf Karte funktionieren

### 3.5 Termin-Validierung
Testen Sie die Validierung bei der Terminerstellung:
- [ ] Erstellen Sie Termin ohne Datum → Fehlermeldung
- [ ] Erstellen Sie Termin ohne Ort → Fehlermeldung
- [ ] Erstellen Sie Termin ohne Beschreibung → Fehlermeldung
- [ ] Erstellen Sie Termin mit ungültigem Datum (vergangen) → Warnung oder Fehler
- [ ] Erstellen Sie Termin mit Uhrzeit "von" nach "bis" → Fehlermeldung

## 4. Abstimmung (Voting)

### 4.1 Erste Abstimmung - Ja
- [ ] Melden Sie sich als Mitglied an
- [ ] Navigieren Sie zur Termine-Seite (`/termine`)
- [ ] Klicken Sie auf einen Termin
- [ ] Klicken Sie auf "Ja" (Teilnahme)
- [ ] **Erwartet**: Stimme wird gespeichert
- [ ] **Erwartet**: "Ja" ist markiert/aktiv
- [ ] **Erwartet**: Stimme wird in den Ergebnissen angezeigt

### 4.2 Abstimmung ändern - Von Ja zu Nein
- [ ] Melden Sie sich als Mitglied an
- [ ] Navigieren Sie zur Termine-Seite
- [ ] Klicken Sie auf einen Termin, bei dem Sie bereits mit "Ja" abgestimmt haben
- [ ] Klicken Sie auf "Nein"
- [ ] **Erwartet**: Alte Stimme wird überschrieben
- [ ] **Erwartet**: "Nein" ist markiert/aktiv
- [ ] **Erwartet**: Nur eine Stimme pro Benutzer wird angezeigt

### 4.3 Abstimmung ändern - Von Nein zu Vielleicht
- [ ] Melden Sie sich als Mitglied an
- [ ] Navigieren Sie zur Termine-Seite
- [ ] Klicken Sie auf einen Termin, bei dem Sie mit "Nein" abgestimmt haben
- [ ] Klicken Sie auf "Vielleicht"
- [ ] **Erwartet**: Alte Stimme wird überschrieben
- [ ] **Erwartet**: "Vielleicht" ist markiert/aktiv

### 4.4 Eine Stimme pro Benutzer pro Termin
- [ ] Melden Sie sich als Mitglied an
- [ ] Stimmen Sie für einen Termin mit "Ja"
- [ ] Versuchen Sie, eine zweite Stimme abzugeben
- [ ] **Erwartet**: Alte Stimme wird ersetzt (nicht zusätzlich hinzugefügt)
- [ ] **Erwartet**: Immer nur eine aktive Stimme pro Benutzer

### 4.5 Abstimmungsergebnisse anzeigen
- [ ] Melden Sie sich als Admin oder Mitglied an
- [ ] Navigieren Sie zu einem Termin
- [ ] **Erwartet**: Anzahl der Ja-Stimmen wird angezeigt
- [ ] **Erwartet**: Anzahl der Nein-Stimmen wird angezeigt
- [ ] **Erwartet**: Anzahl der Vielleicht-Stimmen wird angezeigt
- [ ] Optional: Liste der Abstimmenden mit Namen wird angezeigt

### 4.6 Admins können auch abstimmen
- [ ] Melden Sie sich als Admin an
- [ ] Navigieren Sie zur Termine-Seite
- [ ] Stimmen Sie für einen Termin
- [ ] **Erwartet**: Admin-Stimme wird gezählt
- [ ] **Erwartet**: Admin-Stimme erscheint in den Ergebnissen

### 4.7 Abstimmung nach Termin-Änderung
- [ ] Erstellen Sie einen Termin mit Datum
- [ ] Stimmen Sie für den Termin
- [ ] Ändern Sie als Admin das Datum oder die Uhrzeit
- [ ] **Erwartet**: Abstimmungen bleiben erhalten
- [ ] **Erwartet**: Stimmen werden nicht zurückgesetzt

## 5. News-Verwaltung

### 5.1 News-Artikel erstellen
- [ ] Melden Sie sich als Admin an
- [ ] Navigieren Sie zum Adminbereich (`/admin/news`)
- [ ] Klicken Sie auf "Neuen Artikel erstellen"
- [ ] Füllen Sie alle Pflichtfelder:
  - [ ] Titel: "Test-Artikel für QA"
  - [ ] Inhalt: "Dies ist ein Test-Inhalt für die Qualitätssicherung."
  - [ ] Datum: Automatisch oder manuell gewählt
- [ ] Optional: Kategorie (falls verfügbar)
- [ ] Klicken Sie auf "Speichern"
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Artikel erscheint in der News-Liste
- [ ] **Erwartet**: Artikel ist auf der öffentlichen News-Seite sichtbar

### 5.2 News-Artikel bearbeiten
- [ ] Melden Sie sich als Admin an
- [ ] Navigieren Sie zum Adminbereich (`/admin/news`)
- [ ] Klicken Sie auf "Bearbeiten" bei einem Artikel
- [ ] Ändern Sie den Titel
- [ ] Erweitern Sie den Inhalt
- [ ] Klicken Sie auf "Speichern"
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Änderungen sind in der Admin-Liste sichtbar
- [ ] **Erwartet**: Geänderte Details sind auf der öffentlichen Detailseite sichtbar

### 5.3 News-Artikel löschen
- [ ] Melden Sie sich als Admin an
- [ ] Navigieren Sie zum Adminbereich (`/admin/news`)
- [ ] Klicken Sie auf "Löschen" bei einem Testartikel
- [ ] Bestätigen Sie die Löschung
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Artikel ist nicht mehr in der Liste
- [ ] **Erwartet**: Detailseite gibt 404 zurück

### 5.4 News-Liste (Öffentlich)
- [ ] Navigieren Sie zur News-Seite (`/news`)
- [ ] **Erwartet**: Alle veröffentlichten Artikel werden angezeigt
- [ ] **Erwartet**: Artikel sind sortiert (neueste zuerst oder konfigurierte Sortierung)
- [ ] **Erwartet**: Jeder Artikel zeigt Titel, Datum, evtl. Teaser

### 5.5 News-Detailseite (Öffentlich)
- [ ] Klicken Sie auf einen Artikel in der News-Liste
- [ ] **Erwartet**: Vollständiger Artikel wird angezeigt
- [ ] **Erwartet**: Titel, Datum, Inhalt sind sichtbar
- [ ] **Erwartet**: "Zurück"-Button oder Link zur Liste funktioniert

### 5.6 News-Pagination
- [ ] Erstellen Sie mehr als 10 News-Artikel (falls Paginierung aktiviert)
- [ ] Navigieren Sie zur News-Seite
- [ ] **Erwartet**: Paginierung wird angezeigt
- [ ] **Erwartet**: Navigation zwischen Seiten funktioniert
- [ ] **Erwartet**: Alle Artikel sind erreichbar

### 5.7 News-Validierung
Testen Sie die Validierung bei der Artikelerstellung:
- [ ] Erstellen Sie Artikel ohne Titel → Fehlermeldung
- [ ] Erstellen Sie Artikel ohne Inhalt → Fehlermeldung
- [ ] Erstellen Sie Artikel mit extrem langem Titel → Warnung oder Trunkierung

## 6. Profil-Verwaltung

### 6.1 Profil anzeigen
- [ ] Melden Sie sich als Mitglied an
- [ ] Navigieren Sie zum Profil (`/profil`)
- [ ] **Erwartet**: Alle Benutzerdaten werden angezeigt:
  - [ ] Name
  - [ ] E-Mail
  - [ ] Adresse (falls vorhanden)
  - [ ] Telefon (falls vorhanden)
- [ ] **Erwartet**: E-Mail ist schreibgeschützt (nicht änderbar)

### 6.2 Profil bearbeiten - Name
- [ ] Melden Sie sich als Mitglied an
- [ ] Navigieren Sie zum Profil
- [ ] Klicken Sie auf "Bearbeiten"
- [ ] Ändern Sie den Namen
- [ ] Klicken Sie auf "Speichern"
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Neuer Name wird angezeigt
- [ ] **Erwartet**: Änderung ist im System persistent

### 6.3 Profil bearbeiten - Adresse
- [ ] Melden Sie sich als Mitglied an
- [ ] Navigieren Sie zum Profil
- [ ] Klicken Sie auf "Bearbeiten"
- [ ] Ändern Sie die Adresse
- [ ] Klicken Sie auf "Speichern"
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Neue Adresse wird angezeigt
- [ ] **Erwartet**: Änderung ist persistent

### 6.4 Profil bearbeiten - Telefon
- [ ] Melden Sie sich als Mitglied an
- [ ] Navigieren Sie zum Profil
- [ ] Klicken Sie auf "Bearbeiten"
- [ ] Ändern Sie die Telefonnummer
- [ ] Klicken Sie auf "Speichern"
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Neue Telefonnummer wird angezeigt
- [ ] **Erwartet**: Änderung ist persistent

### 6.5 Passwort ändern (falls verfügbar)
- [ ] Melden Sie sich als Mitglied an
- [ ] Navigieren Sie zum Profil
- [ ] Klicken Sie auf "Passwort ändern"
- [ ] Geben Sie aktuelles Passwort ein
- [ ] Geben Sie neues Passwort ein (mindestens 6 Zeichen)
- [ ] Bestätigen Sie das neue Passwort
- [ ] Klicken Sie auf "Speichern"
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Neues Passwort funktioniert beim Login
- [ ] **Erwartet**: Altes Passwort funktioniert nicht mehr

### 6.6 Profil-Validierung
Testen Sie die Validierung bei der Profilveränderung:
- [ ] Speichern Sie leere Pflichtfelder → Fehlermeldung
- [ ] Speichern Sie ungültige E-Mail-Adresse → Fehlermeldung (falls änderbar)
- [ ] Passwort ändern ohne Bestätigung → Fehlermeldung
- [ ] Passwort ändern mit falschem aktuellem Passwort → Fehlermeldung

## 7. Öffentliche Seiten

### 7.1 Startseite
- [ ] Navigieren Sie zur Startseite (`/`)
- [ ] **Erwartet**: Header mit Logo und Navigation ist sichtbar
- [ ] **Erwartet**: Hero-Section oder Willkommensnachricht wird angezeigt
- [ ] **Erwartet**: Aktuelle News oder Termine werden angezeigt
- [ ] **Erwartet**: Footer mit Links ist sichtbar
- [ ] **Erwartet**: Alle Links funktionieren
- [ ] **Erwartet**: Responsive Design funktioniert (Mobile-Ansicht testen)

### 7.2 Termine-Seite (Öffentlich)
- [ ] Navigieren Sie zur Termine-Seite (`/termine`)
- [ ] **Erwartet**: Liste aller Termine wird angezeigt
- [ ] **Erwartet**: Datum, Uhrzeit, Ort, Beschreibung sind sichtbar
- [ ] **Erwartet**: Sortierung nach Datum (nächste zuerst)
- [ ] [ ] Klicken Sie auf einen Termin → Detailseite wird angezeigt

### 7.3 Impressum
- [ ] Navigieren Sie zum Impressum (`/impressum`)
- [ ] **Erwartet**: Alle Pflichtangaben sind sichtbar:
  - [ ] Name der Organisation
  - [ ] Adresse
  - [ ] Kontakt (E-Mail, Telefon)
  - [ ] Vertretungsberechtigte Personen
  - [ ] Registereintrag (falls vorhanden)
  - [ ] USt-ID (falls vorhanden)
- [ ] **Erwartet**: Alle Links funktionieren

### 7.4 Datenschutzerklärung
- [ ] Navigieren Sie zur Datenschutzerklärung (`/datenschutz`)
- [ ] **Erwartet**: Alle relevanten Informationen sind sichtbar:
  - [ ] Datenverarbeitungszwecke
  - [ ] Rechtsgrundlagen
  - [ ] Empfänger von Daten
  - [ ] Speicherdauer
  - [ ] Betroffenenrechte
  - [ ] Kontakt für Datenschutzfragen
- [ ] **Erwartet**: Cookie-Banner wird angezeigt (falls Cookies verwendet)

### 7.5 Cookie-Banner (falls vorhanden)
- [ ] Löschen Sie alle Cookies
- [ ] Navigieren Sie zur Startseite
- [ ] **Erwartet**: Cookie-Banner wird angezeigt
- [ ] Klicken Sie auf "Akzeptieren"
- [ ] **Erwartet**: Banner verschwindet
- [ ] **Erwartet**: Entscheidung wird gespeichert
- [ ] Laden Sie die Seite neu
- [ ] **Erwartet**: Banner wird nicht mehr angezeigt

## 8. Kontaktformular

### 8.1 Kontaktformular ausfüllen und senden
- [ ] Navigieren Sie zur Kontakt-Seite (`/kontakt`)
- [ ] Füllen Sie alle Pflichtfelder:
  - [ ] Name: "Test Tester"
  - [ ] E-Mail: `test@example.com`
  - [ ] Nachricht: "Dies ist eine Test-Nachricht."
- [ ] Klicken Sie auf "Senden"
- [ ] **Erwartet**: Erfolgsmeldung wird angezeigt
- [ ] **Erwartet**: Formular wird geleert
- [ ] **Erwartet**: E-Mail wird an Admin-Empfänger gesendet

### 8.2 Kontaktformular-Validierung
- [ ] Senden Sie leeres Formular → Alle Fehlermeldungen werden angezeigt
- [ ] Senden Sie Formular ohne Name → Fehlermeldung
- [ ] Senden Sie Formular ohne E-Mail → Fehlermeldung
- [ ] Senden Sie Formular mit ungültiger E-Mail → Fehlermeldung
- [ ] Senden Sie Formular ohne Nachricht → Fehlermeldung

### 8.3 E-Mail-Empfang prüfen
- [ ] Senden Sie Test-Nachricht über Kontaktformular
- [ ] Prüfen Sie das E-Mail-Postfach der Admin-Empfänger
- [ ] **Erwartet**: E-Mail ist angekommen
- [ ] **Erwartet**: Absender-Adresse ist korrekt
- [ ] **Erwartet**: Betreff ist aussagekräftig
- [ ] **Erwartet**: Inhalt enthält:
  - [ ] Name des Absenders
  - [ ] E-Mail des Absenders
  - [ ] Nachricht
  - [ ] Datum/Uhrzeit

### 8.4 Mehrere Admin-Empfänger
- [ ] Konfigurieren Sie mehrere Admin-E-Mails in `.env`
- [ ] Senden Sie Test-Nachricht
- [ ] **Erwartet**: Alle Admin-Empfänger erhalten die E-Mail

## 9. Navigation und UI

### 9.1 Header-Navigation
- [ ] Prüfen Sie alle Links im Header:
  - [ ] Startseite
  - [ ] Termine
  - [ ] News
  - [ ] Kontakt
- [ ] **Erwartet**: Alle Links funktionieren
- [ ] **Erwartet**: Aktuelle Seite ist hervorgehoben
- [ ] **Erwartet**: Dropdown-Menüs funktionieren (falls vorhanden)

### 9.2 Footer-Navigation
- [ ] Prüfen Sie alle Links im Footer:
  - [ ] Impressum
  - [ ] Datenschutzerklärung
  - [ ] Kontakt
- [ ] **Erwartet**: Alle Links funktionieren

### 9.3 Breadcrumbs (falls vorhanden)
- [ ] Navigieren Sie zu einer Unterseite
- [ ] **Erwartet**: Breadcrumbs werden angezeigt
- [ ] **Erwartet**: Alle Breadcrumb-Links funktionieren

### 9.4 Responsive Design - Mobile
- [ ] Öffnen Sie die Anwendung in Mobile-Ansicht (z.B. Chrome DevTools)
- [ ] Testen Sie auf verschiedenen Viewports:
  - [ ] iPhone SE (375x667)
  - [ ] iPhone 12 Pro (390x844)
  - [ ] iPad (768x1024)
- [ ] **Erwartet**: Layout ist auf allen Viewports verwendbar
- [ ] **Erwartet**: Hamburger-Menü funktioniert auf Mobile
- [ ] **Erwartet**: Alle Inhalte sind lesbar
- [ ] **Erwartet**: Touch-Targets sind groß genug (mindestens 44x44px)

### 9.5 Responsive Design - Desktop
- [ ] Testen Sie auf verschiedenen Desktop-Auflösungen:
  - [ ] 1366x768 (Laptop)
  - [ ] 1920x1080 (Full HD)
  - [ ] 2560x1440 (2K)
- [ ] **Erwartet**: Layout passt sich korrekt an
- [ ] **Erwartet**: Keine horizontalen Scrollbars
- [ ] **Erwartet**: Inhalte sind gut lesbar

## 10. Rollen und Berechtigungen

### 10.1 Admin-Zugriffskontrolle
- [ ] Melden Sie sich als Admin an
- [ ] Prüfen Sie Zugriff auf Admin-Seiten:
  - [ ] `/admin/users` → Zugriff erlaubt
  - [ ] `/admin/events` → Zugriff erlaubt
  - [ ] `/admin/news` → Zugriff erlaubt
- [ ] Prüfen Sie, ob Admin-Buttons sichtbar sind:
  - [ ] Erstellen-Button für Termine
  - [ ] Erstellen-Button für News
  - [ ] Admin-Link im Menü

### 10.2 Mitglied-Zugriffskontrolle
- [ ] Melden Sie sich als Mitglied (nicht Admin) an
- [ ] Versuchen Sie, auf Admin-Seiten zuzugreifen:
  - [ ] `/admin/users` → Weiterleitung oder "Zugriff verweigert"
  - [ ] `/admin/events` → Weiterleitung oder "Zugriff verweigert"
  - [ ] `/admin/news` → Weiterleitung oder "Zugriff verweigert"
- [ ] Prüfen Sie, ob Admin-Buttons NICHT sichtbar sind:
  - [ ] Kein Erstellen-Button für Termine
  - [ ] Kein Erstellen-Button für News
  - [ ] Kein Admin-Link im Menü

### 10.3 Nicht-angemeldete Zugriffskontrolle
- [ ] Melden Sie sich ab
- [ ] Prüfen Sie Zugriff auf geschützte Seiten:
  - [ ] `/profil` → Weiterleitung zu `/login`
  - [ ] `/admin/users` → Weiterleitung zu `/login`
- [ ] Prüfen Sie Zugriff auf öffentliche Seiten:
  - [ ] `/` → Zugriff erlaubt
  - [ ] `/termine` → Zugriff erlaubt
  - [ ] `/news` → Zugriff erlaubt
  - [ ] `/kontakt` → Zugriff erlaubt
  - [ ] `/impressum` → Zugriff erlaubt
  - [ ] `/datenschutz` → Zugriff erlaubt

## 11. Cross-Browser-Testing

### 11.1 Chrome/Chromium
- [ ] Führen Sie alle Tests in Chrome durch
- [ ] Notieren Sie etwaige Probleme

### 11.2 Firefox
- [ ] Führen Sie alle Tests in Firefox durch
- [ ] **Erwartet**: Gleiches Verhalten wie in Chrome
- [ ] Notieren Sie etwaige Probleme

### 11.3 Safari (falls verfügbar)
- [ ] Führen Sie alle Tests in Safari durch
- [ ] **Erwartet**: Gleiches Verhalten wie in Chrome
- [ ] Notieren Sie etwaige Probleme

### 11.4 Edge (falls verfügbar)
- [ ] Führen Sie alle Tests in Edge durch
- [ ] **Erwartet**: Gleiches Verhalten wie in Chrome
- [ ] Notieren Sie etwaige Probleme

## 12. Performance-Tests

### 12.1 Ladezeit-Tests
- [ ] Messen Sie die Ladezeit der Startseite:
  - [ ] Initial Load: < 3 Sekunden
  - [ ] Time to Interactive: < 5 Sekunden
- [ ] Messen Sie die Ladezeit der Termine-Seite:
  - [ ] Initial Load: < 3 Sekunden
- [ ] Messen Sie die Ladezeit der News-Seite:
  - [ ] Initial Load: < 3 Sekunden

### 12.2 Page Speed Insight (optional)
- [ ] Testen Sie die Seite mit Google PageSpeed Insights
- [ ] **Erwartet**: Desktop-Score > 90
- [ ] **Erwartet**: Mobile-Score > 70

### 12.3 Performance mit vielen Einträgen
- [ ] Erstellen Sie 50+ Termine
- [ ] Erstellen Sie 50+ News-Artikel
- [ ] Navigieren Sie zur Termine-Seite
- [ ] **Erwartet**: Seite lädt noch schnell (< 5 Sekunden)
- [ ] Navigieren Sie zur News-Seite
- [ ] **Erwartet**: Seite lädt noch schnell (< 5 Sekunden)

## 13. Security-Tests

### 13.1 XSS-Prevention
- [ ] Füllen Sie das Kontaktformular mit `<script>alert('XSS')</script>`
- [ ] Senden Sie das Formular
- [ ] Prüfen Sie die Admin-E-Mail
- [ ] **Erwartet**: Script wird nicht ausgeführt
- [ ] **Erwartet**: Script wird als Text angezeigt oder escaped

### 13.2 SQL-Injection-Prevention
- [ ] (Nur wenn Login mit E-Mail funktioniert) Versuchen Sie: `' OR '1'='1`
- [ ] **Erwartet**: Login schlägt fehl
- [ ] **Erwartet**: Keine Fehlermeldung verrät SQL-Struktur

### 13.3 CSRF-Schutz (falls relevant)
- [ ] Testen Sie, ob Formulare CSRF-Tokens verwenden
- [ ] **Erwartet**: Token ist im Formular versteckt

### 13.4 HTTPS-Only (nur Produktion)
- [ ] Prüfen Sie, ob die Seite nur über HTTPS zugänglich ist
- [ ] **Erwartet**: HTTP zu HTTPS Redirect funktioniert
- [ ] **Erwartet**: Mixed Content keine Warnungen

## 14. Accessibility (a11y)

### 14.1 Tastaturnavigation
- [ ] Navigieren Sie durch die Seite nur mit der Tab-Taste
- [ ] **Erwartet**: Alle interaktiven Elemente sind erreichbar
- [ ] **Erwartet**: Fokus ist immer sichtbar
- [ ] **Erwartet**: Logische Fokus-Reihenfolge

### 14.2 Screen-Reader-Tests (optional)
- [ ] Testen Sie die Seite mit einem Screen-Reader
- [ ] **Erwartet**: Alle Bilder haben Alt-Texte
- [ ] **Erwartet**: Alle Formulare haben Labels
- [ ] **Erwartet**: Semantisches HTML wird korrekt vorgelesen

### 14.3 Farbkontrast
- [ ] Prüfen Sie den Farbkontrast von Text
- [ ] **Erwartet**: Kontrast >= 4.5:1 für normalen Text
- [ ] **Erwartet**: Kontrast >= 3:1 für großen Text

## 15. Datenbank-Integrität

### 15.1 Termin-Stimmen nach Löschung
- [ ] Erstellen Sie einen Termin
- [ ] Stimmen Sie für den Termin
- [ ] Löschen Sie den Termin
- [ ] **Erwartet**: Keine Fehler auftreten
- [ ] **Erwartet**: Stimmen werden aus der Datenbank gelöscht (Cascade)

### 15.2 Benutzer-Stimmen nach Löschung
- [ ] Erstellen Sie einen Benutzer
- [ ] Stimmen Sie für einen Termin als dieser Benutzer
- [ ] Löschen Sie den Benutzer
- [ ] **Erwartet**: Keine Fehler auftreten
- [ ] **Erwartet**: Stimmen werden aus der Datenbank gelöscht oder anonymisiert

## 16. Error-Handling

### 16.1 404-Seiten
- [ ] Navigieren Sie zu einer nicht existierenden Seite (z.B. `/nicht-vorhanden`)
- [ ] **Erwartet**: 404-Seite wird angezeigt
- [ ] **Erwartet**: Hilfreiche Nachricht wird gezeigt
- [ ] **Erwartet**: Link zur Startseite ist vorhanden

### 16.2 500-Fehler (Simulation)
- [ ] (Optional) Simulieren Sie einen Server-Fehler
- [ ] **Erwartet**: 500-Seite wird angezeigt
- [ ] **Erwartet**: Hilfreiche Nachricht wird gezeigt

### 16.3 Network-Error-Handling
- [ ] Deaktivieren Sie das Netzwerk (offline mode)
- [ ] Versuchen Sie, ein Formular zu senden
- [ ] **Erwartet**: Fehlermeldung wird angezeigt
- [ ] **Erwartet**: Keine Daten gehen verloren (Formular-Inhalte bleiben)

## Test-Ergebnisse dokumentieren

### Zusammenfassung
- **Datum**: _____
- **Tester**: _____
- **Environment**: Entwicklung / Staging / Produktion
- **Browser**: Chrome ____ / Firefox ____ / Safari ____ / Edge ____
- **Gesamtzahl der Tests**: _____
- **Bestandene Tests**: _____
- **Fehlgeschlagene Tests**: _____

### Gefundene Probleme
| Beschreibung | Schweregrad | Status |
|-------------|-------------|--------|
| | | |
| | | |

### Notizen
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________
