# Testkampagne: echte Abdeckung statt Mock-Spiegel

Status: ready-for-agent

## What to build

Aus dem Gesamt-Review 2026-07-30 (Befunde F25–F27, bewusst zurückgestellte Teile):

1. **Sicherheits-Middleware nicht wegmocken:** Die Routen-Tests mocken
   `validateCsrfHeaders`/`validateRequestBody` global zu No-Ops. Mindestens je Route ein
   Test, der nachweist, dass die Route die CSRF-Validierung tatsächlich AUFRUFT
   (Entfernen des Aufrufs muss einen Test brechen).
2. **Hand-gerollter next/server-Fake** (`jest.setup.js:28–88`): Headers case-sensitiv,
   kein `cookies`, kein `formData()`. Prüfen, ob die Route-Tests auf die echten
   next/server-Klassen umgestellt werden können; sonst Fake härten
   (case-insensitive Headers, formData).
3. **Ungetestete Routen:** `app/api/admin/events` (+`[id]`), `app/api/admin/news`
   (+`[id]`), `app/api/news` (+`[id]`), `app/api/admin/polls/[id]/reopen`,
   `app/api/user/profile`.
4. **Ungetestete Libs mit Risiko:** `audit-log`, `auth-proof` (sicherheitsrelevant),
   `zip-parser`, `document-mime-detection` (parsen nicht vertrauenswürdige Uploads),
   `api-error-handler`, `server-error-mapper`, `fetch-with-timeout`.
5. **String-Spiegel-Tests entschärfen:** `container-hardening.test.ts` /
   `haproxy-config.test.ts` pinnen exakte Substrings inkl. Kommentaren; wo möglich auf
   Verhaltens- oder Struktur-Assertions umstellen (Vorbild: `next-config.test.ts`).
6. **Coverage-Gate:** `jest.config.ts` definiert Schwellen (80/70), aber weder
   `pnpm test` noch `deploy.sh` erzwingen sie. Entscheiden: `test:coverage` ins
   Deploy-Gate oder Schwellen entfernen.

Bereits erledigt im Review-Fix (nicht Teil dieses Tickets): tautologische Tests
entfernt (`admin-users.test.ts` bereinigt, `user-management-hook.test.ts` gelöscht),
echte Tests für `change-password`, `events/[id]/vote`, `proxy.ts`,
`admin/users/[id]` PATCH ergänzt.
