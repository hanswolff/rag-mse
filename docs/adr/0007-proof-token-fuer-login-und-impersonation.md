# Kurzlebige Proof-Token für Login und Impersonation

Zwischen zwei Schritten eines mehrstufigen Vorgangs gibt der Server dem Browser einen
signierten, kurzlebigen **Proof** mit (`lib/auth-proof.ts`), statt den ersten Schritt
im zweiten zu wiederholen oder serverseitigen Zwischenzustand zu halten. Es gibt zwei
Ausprägungen:

- **Login-Proof:** bindet E-Mail, Client-IP und einen mit `NEXTAUTH_SECRET`
  geschlüsselten Passwort-Digest, Laufzeit 60 Sekunden.
- **Impersonations-Proof:** bindet Aktion (`start`/`stop`), handelnden Benutzer,
  Zielbenutzer und den effektiven Benutzer, Laufzeit 60 Sekunden.

Der Passwort-Digest ist bewusst ein **HMAC mit `NEXTAUTH_SECRET`**, kein blanker
SHA-256: Der Proof geht an den Browser, und ein ungesalzener Passwort-Hash darin wäre
offline angreifbar. Die Bindung an genau dieses Passwort bleibt erhalten — nur sie
erlaubt dem Proof, die erneute Passwortprüfung zu ersetzen.

## Considered Options

- **Gewählt: signierter Proof beim Client.** Kein serverseitiger Zwischenzustand, der
  konsistent gehalten oder aufgeräumt werden müsste, und keine zweite Passwortabfrage.
  Die enge Bindung (Passwort, IP, Ablauf) macht einen abgefangenen Proof praktisch
  wertlos.
- **Verworfen: Passwort erneut prüfen.** Das Passwort müsste ein zweites Mal durch den
  Browser laufen oder im Formular zwischengelagert werden.
- **Verworfen: serverseitige Sitzung für den Zwischenschritt.** Zusätzlicher Zustand
  mit Ablauf- und Aufräumlogik für einen Vorgang, der eine Minute dauert.

## Consequences

- **Ohne `NEXTAUTH_SECRET` funktioniert nichts davon** — das ist beabsichtigt und wird
  als `LoginProofUnavailableError` sichtbar, statt still auf einen schwächeren Pfad
  zurückzufallen.
- Ändert ein Benutzer sein Passwort, wird ein noch laufender Proof ungültig, weil der
  Digest nicht mehr passt.
- Der Login-Proof ist an die Client-IP gebunden: Ein Netzwechsel mitten im Vorgang
  (Mobilfunk zu WLAN) macht ihn ungültig und erzwingt einen neuen Anlauf. Das ist der
  bewusst gewählte Preis für die Bindung.
- Die Version steckt im Proof (`v1`, `v1i`), damit ein späterer Formatwechsel alte
  Token gezielt ablehnen kann.
