# Sicherheits-Restbefunde (niedrige Schwere)

Status: ready-for-agent

## What to build

Aus dem Sicherheits-Review 2026-07-30, bewusst zurückgestellte Punkte niedriger Schwere.

1. **CSRF-Prüfung überspringt Nicht-Browser-User-Agents** (`lib/csrf-validator.ts:37-46`):
   Fehlt `Mozilla`/`Chrome`/`Safari`/`Firefox`/`Edge` im UA, wird Origin/Referer nicht
   validiert. Nicht browser-ausnutzbar (`User-Agent` ist für `fetch` ein verbotener
   Header) und SameSite=lax deckt den Rest ab — die Ausnahme bringt aber keinen Nutzen
   und sollte entfallen.
2. **Token-Entropie ~59 Bit** (`lib/crypto-utils.ts:9`, `generateRandomToken(length = 10)`,
   base62): Mit dem 25-Versuche-Limit pro IP/15 min praktisch nicht erratbar, liegt aber
   deutlich unter den üblichen 128 Bit für Bearer-Credentials. Auf 22 Zeichen (~131 Bit)
   anheben; Länge ist parametrisiert, Aufwand gering.
3. **Rate-Limit-Zustand nur im Prozess** (`lib/rate-limit-store.ts`): Jeder Deploy/Neustart
   löscht Sperren; ein Angreifer, der eine 60-Minuten-Sperre auslöst, wartet einfach den
   nächsten Neustart ab. In `.env.example:47-49` als akzeptiert dokumentiert —
   entscheiden, ob Persistenz (SQLite-Tabelle) gewünscht ist.
4. ~~**Prüfungs-Lösungen öffentlich abrufbar**~~ — **entschieden 30.07.2026: kein
   Befund.** `public/dokumente/Fragenkatalog_Sachkundepruefung_mit_Antworten.pdf` ist
   absichtlich ohne Login abrufbar (Prüfungsvorbereitung, kein schützenswerter Inhalt).
   Gilt für alle Dateien unter `public/dokumente/`; festgehalten in AGENTS.md unter
   „Confirmed requirements“. Nichts zu tun.
5. **Reset-Token-GET verrät die zugehörige E-Mail**
   (`app/api/auth/reset-password/[token]/route.ts:70`): Nur für den Token-Inhaber (also
   den Postfach-Eigentümer) erreichbar; Auswirkung gering. Prüfen, ob die Anzeige der
   Adresse im Formular fachlich nötig ist.

Bereits behoben (nicht Teil dieses Tickets): Sessions gelöschter Benutzer, Passwort-Digest
im Login-Proof (jetzt HMAC-geschlüsselt), X-Forwarded-For-Vertrauen (fail-closed),
Klartext-Token im Postausgang, Ratenlimit für Reset-/Einladungs-GET, Stammdaten im
Einladungs-GET.

Präzisierung Klartext-Token (30.07.2026, Regressions-Review): Bei **FAILED** bleiben die
separat gespeicherten Einmal-Token erhalten, damit der manuelle Admin-Retry
funktionierende Links wiederherstellen kann; die Wartung entfernt sie nach 30 Tagen
endgültig (danach lehnt der Retry solche E-Mails ab). Bei **SENT** werden sie weiterhin
sofort gelöscht. Reset-/Einladungs-GET nutzt seit dem Review ein eigenes, großzügigeres
Lese-Budget (`token-read`), damit Seitenaufrufe nicht die wenigen Einlöseversuche
verbrauchen; Enumeration bremst unverändert das IP-Limit.
