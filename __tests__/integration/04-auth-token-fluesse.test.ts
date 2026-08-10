import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";
import {
  GET as resetPasswordStatusRoute,
  POST as resetPasswordRoute,
} from "@/app/api/auth/reset-password/[token]/route";
import {
  GET as invitationStatusRoute,
  POST as redeemInvitationRoute,
} from "@/app/api/invitations/[token]/route";
import { POST as createAdminInvitationRoute } from "@/app/api/admin/invitations/route";
import { apiRequest, routeContext } from "./helpers/api";
import { loginAs } from "./helpers/auth";
import {
  TEST_PASSWORD,
  createAdmin,
  createInvitation,
  createPasswordReset,
  createSiteAdministrator,
  createUser,
} from "./helpers/factories";

const NEW_PASSWORD = "NeuesPasswort1";

function login(email: string, password: string) {
  return loginRoute(apiRequest("POST", "/api/auth/login", { body: { email, password } }));
}

function forgotPassword(email: string) {
  return forgotPasswordRoute(
    apiRequest("POST", "/api/auth/forgot-password", { body: { email } })
  );
}

function resetPasswordStatus(token: string) {
  return resetPasswordStatusRoute(
    apiRequest("GET", `/api/auth/reset-password/${token}`),
    routeContext({ token })
  );
}

function resetPassword(token: string, password: string) {
  return resetPasswordRoute(
    apiRequest("POST", `/api/auth/reset-password/${token}`, { body: { password } }),
    routeContext({ token })
  );
}

function invitationStatus(token: string) {
  return invitationStatusRoute(
    apiRequest("GET", `/api/invitations/${token}`),
    routeContext({ token })
  );
}

interface RedemptionBodyOverrides {
  name?: string;
  address?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

function redeemInvitation(token: string, overrides: RedemptionBodyOverrides = {}) {
  const body = {
    name: "Erika Musterfrau",
    address: "Musterstraße 1, 12345 Musterstadt",
    phone: "+49 170 1234567",
    password: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
    ...overrides,
  };
  return redeemInvitationRoute(
    apiRequest("POST", `/api/invitations/${token}`, { body }),
    routeContext({ token })
  );
}

function createAdminInvitation(email: string) {
  return createAdminInvitationRoute(
    apiRequest("POST", "/api/admin/invitations", { body: { email } })
  );
}

describe("Integrationsschicht: Auth- und Token-Flüsse", () => {
  describe("Login", () => {
    it("meldet einen Benutzer mit korrektem Passwort an und liefert einen Login-Proof", async () => {
      const user = await createUser();

      const response = await login(user.email, TEST_PASSWORD);

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.success).toBe(true);
      expect(payload.loginProof).toEqual(expect.stringMatching(/^v1\./));

      const fromDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(fromDb.lastLoginAt).not.toBeNull();
    });

    it("lehnt ein falsches Passwort mit 401 ab", async () => {
      const user = await createUser();

      const response = await login(user.email, "FalschesPasswort1");

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        error: "Ungültige E-Mail oder Passwort",
      });
    });

    it("lehnt eine unbekannte E-Mail mit 401 ab", async () => {
      const response = await login("gibt-es-nicht@example.com", TEST_PASSWORD);

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        error: "Ungültige E-Mail oder Passwort",
      });
    });

    it("lehnt ein nicht aktiviertes Konto ab, solange das Zufallspasswort unbekannt ist", async () => {
      // Produktionspfad: Admin-seitig angelegte Konten erhalten ein zufälliges,
      // niemandem bekanntes Passwort und activatedAt = null.
      const user = await createUser({ activatedAt: null });

      const response = await login(user.email, "GeratenesPasswort1");

      expect(response.status).toBe(401);
    });

    it("lehnt ein nicht aktiviertes Konto auch mit korrektem Passwort ab", async () => {
      const user = await createUser({ activatedAt: null });

      const response = await login(user.email, TEST_PASSWORD);

      expect(response.status).toBe(401);
      const fromDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(fromDb.activatedAt).toBeNull();
      expect(fromDb.lastLoginAt).toBeNull();
    });

    it("lässt ein nicht aktiviertes Konto nach der Aktivierung wieder anmelden", async () => {
      const user = await createUser({ activatedAt: null });
      await prisma.user.update({ where: { id: user.id }, data: { activatedAt: new Date() } });

      const response = await login(user.email, TEST_PASSWORD);

      expect(response.status).toBe(200);
    });

    it("aktiviert einen Site-Administrator beim ersten erfolgreichen Login automatisch", async () => {
      const siteAdmin = await createSiteAdministrator({ activatedAt: null });

      const response = await login(siteAdmin.email, TEST_PASSWORD);

      expect(response.status).toBe(200);
      const fromDb = await prisma.user.findUniqueOrThrow({ where: { id: siteAdmin.id } });
      expect(fromDb.activatedAt).not.toBeNull();
    });

    it("blockiert nach fünf Fehlversuchen auch das korrekte Passwort mit 429", async () => {
      const user = await createUser();

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const response = await login(user.email, "FalschesPasswort1");
        expect(response.status).toBe(401);
      }

      const blocked = await login(user.email, TEST_PASSWORD);

      expect(blocked.status).toBe(429);
      const payload = await blocked.json();
      expect(payload.error).toMatch(/Zu viele fehlgeschlagene Login-Versuche/);
    });

    it("setzt den Fehlversuchszähler nach erfolgreichem Login zurück", async () => {
      const user = await createUser();

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const response = await login(user.email, "FalschesPasswort1");
        expect(response.status).toBe(401);
      }

      const success = await login(user.email, TEST_PASSWORD);
      expect(success.status).toBe(200);

      // Ohne Zähler-Reset wäre dies der sechste Versuch und damit blockiert (429).
      const afterSuccess = await login(user.email, "FalschesPasswort1");
      expect(afterSuccess.status).toBe(401);
    });
  });

  describe("Passwort zurücksetzen", () => {
    it("legt für ein aktiviertes Konto einen echten PasswordReset an und reiht die E-Mail ein", async () => {
      const user = await createUser();

      const response = await forgotPassword(user.email);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        message: expect.stringContaining("Wenn diese E-Mail registriert ist"),
      });

      const resets = await prisma.passwordReset.findMany({ where: { email: user.email } });
      expect(resets).toHaveLength(1);
      expect(resets[0].usedAt).toBeNull();
      expect(resets[0].expiresAt.getTime()).toBeGreaterThan(Date.now());

      const queuedEmails = await prisma.outgoingEmail.findMany({
        where: { template: "passwort-zuruecksetzen", toRecipients: user.email },
      });
      expect(queuedEmails).toHaveLength(1);
      expect(queuedEmails[0].status).toBe("QUEUED");
    });

    it("antwortet für unbekannte E-Mails identisch, legt aber keinen Datensatz an", async () => {
      const response = await forgotPassword("unbekannt@example.com");

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        message: expect.stringContaining("Wenn diese E-Mail registriert ist"),
      });

      const resets = await prisma.passwordReset.findMany({
        where: { email: "unbekannt@example.com" },
      });
      expect(resets).toHaveLength(0);
    });

    it("legt für ein nicht aktiviertes Konto keinen PasswordReset an", async () => {
      const user = await createUser({ activatedAt: null });

      const response = await forgotPassword(user.email);

      expect(response.status).toBe(200);
      const resets = await prisma.passwordReset.findMany({ where: { email: user.email } });
      expect(resets).toHaveLength(0);
    });

    it("ersetzt bei erneuter Anforderung den alten Datensatz statt einen zweiten anzulegen", async () => {
      const user = await createUser();

      await forgotPassword(user.email);
      const firstReset = await prisma.passwordReset.findFirstOrThrow({
        where: { email: user.email },
      });

      await forgotPassword(user.email);

      const resets = await prisma.passwordReset.findMany({ where: { email: user.email } });
      expect(resets).toHaveLength(1);
      expect(resets[0].tokenHash).not.toBe(firstReset.tokenHash);
    });

    it("blockiert die dritte Anforderung derselben IP-/E-Mail-Kombination mit 429", async () => {
      const user = await createUser();

      expect((await forgotPassword(user.email)).status).toBe(200);
      expect((await forgotPassword(user.email)).status).toBe(200);

      const blocked = await forgotPassword(user.email);
      expect(blocked.status).toBe(429);
    });

    it("validiert einen gültigen Token per GET mit den Reset-Daten", async () => {
      const user = await createUser();
      const { token } = await createPasswordReset({ email: user.email });

      const response = await resetPasswordStatus(token);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ email: user.email });
    });

    it("meldet per GET unbekannte Token mit 404 sowie abgelaufene und benutzte mit 410", async () => {
      const user = await createUser();

      const unknown = await resetPasswordStatus("voellig-unbekannter-token");
      expect(unknown.status).toBe(404);

      const { token: expiredToken } = await createPasswordReset({
        email: user.email,
        expiresAt: new Date(Date.now() - 60_000),
      });
      const expired = await resetPasswordStatus(expiredToken);
      expect(expired.status).toBe(410);

      const { token: usedToken } = await createPasswordReset({
        email: user.email,
        usedAt: new Date(),
      });
      const used = await resetPasswordStatus(usedToken);
      expect(used.status).toBe(410);
    });

    it("setzt das Passwort, verbraucht den Token und erlaubt den Login mit dem neuen Passwort", async () => {
      const user = await createUser();
      const { passwordReset, token } = await createPasswordReset({ email: user.email });

      const response = await resetPassword(token, NEW_PASSWORD);

      expect(response.status).toBe(200);

      const resetFromDb = await prisma.passwordReset.findUniqueOrThrow({
        where: { id: passwordReset.id },
      });
      expect(resetFromDb.usedAt).not.toBeNull();

      const userFromDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(userFromDb.passwordUpdatedAt).not.toBeNull();
      await expect(compare(NEW_PASSWORD, userFromDb.password)).resolves.toBe(true);
      await expect(compare(TEST_PASSWORD, userFromDb.password)).resolves.toBe(false);

      // Login-Beweis über die echte Login-Route gegen die echte Datenbank.
      expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
      expect((await login(user.email, TEST_PASSWORD)).status).toBe(401);
    });

    it("lehnt die zweite Verwendung desselben Tokens mit 410 ab", async () => {
      const user = await createUser();
      const { token } = await createPasswordReset({ email: user.email });

      expect((await resetPassword(token, NEW_PASSWORD)).status).toBe(200);

      const secondUse = await resetPassword(token, "ZweitesPasswort2");

      expect(secondUse.status).toBe(410);
      await expect(secondUse.json()).resolves.toMatchObject({
        error: "Der Link ist abgelaufen",
      });

      // Das Passwort aus der ersten Verwendung bleibt bestehen.
      const userFromDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      await expect(compare(NEW_PASSWORD, userFromDb.password)).resolves.toBe(true);
    });

    it("lehnt abgelaufene Token mit 410 ab und lässt das Passwort unverändert", async () => {
      const user = await createUser();
      const { passwordReset, token } = await createPasswordReset({
        email: user.email,
        expiresAt: new Date(Date.now() - 60_000),
      });

      const response = await resetPassword(token, NEW_PASSWORD);

      expect(response.status).toBe(410);

      const resetFromDb = await prisma.passwordReset.findUniqueOrThrow({
        where: { id: passwordReset.id },
      });
      expect(resetFromDb.usedAt).toBeNull();

      const userFromDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      await expect(compare(TEST_PASSWORD, userFromDb.password)).resolves.toBe(true);
    });

    it("lehnt ein zu schwaches Passwort mit 400 ab, ohne den Token zu verbrauchen", async () => {
      const user = await createUser();
      const { passwordReset, token } = await createPasswordReset({ email: user.email });

      const response = await resetPassword(token, "kurz");

      expect(response.status).toBe(400);

      const resetFromDb = await prisma.passwordReset.findUniqueOrThrow({
        where: { id: passwordReset.id },
      });
      expect(resetFromDb.usedAt).toBeNull();
    });

    it("meldet 404, wenn zum Reset-Datensatz kein Benutzer existiert", async () => {
      const { passwordReset, token } = await createPasswordReset({
        email: "ohne-konto@example.com",
      });

      const response = await resetPassword(token, NEW_PASSWORD);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: "Benutzer nicht gefunden",
      });

      const resetFromDb = await prisma.passwordReset.findUniqueOrThrow({
        where: { id: passwordReset.id },
      });
      expect(resetFromDb.usedAt).toBeNull();
    });
  });

  describe("Einladung", () => {
    it("liefert per GET die Vorbefüllungsdaten für einen gültigen Token", async () => {
      const { invitation, token } = await createInvitation({ role: "MEMBER" });

      const response = await invitationStatus(token);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        email: invitation.email,
        role: "MEMBER",
        name: "",
      });
    });

    it("meldet per GET unbekannte Token mit 404 sowie abgelaufene und eingelöste mit 410", async () => {
      const unknown = await invitationStatus("voellig-unbekannter-token");
      expect(unknown.status).toBe(404);

      const { token: expiredToken } = await createInvitation({
        expiresAt: new Date(Date.now() - 60_000),
      });
      const expired = await invitationStatus(expiredToken);
      expect(expired.status).toBe(410);

      const { token: usedToken } = await createInvitation({ usedAt: new Date() });
      const used = await invitationStatus(usedToken);
      expect(used.status).toBe(410);
    });

    it("legt beim Einlösen den Benutzer wirklich an und erlaubt den Login", async () => {
      const { invitation, token } = await createInvitation({ role: "MEMBER" });

      const response = await redeemInvitation(token);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        message: "Konto wurde erstellt",
        email: invitation.email,
      });

      const userFromDb = await prisma.user.findUniqueOrThrow({
        where: { email: invitation.email },
      });
      expect(userFromDb.name).toBe("Erika Musterfrau");
      expect(userFromDb.role).toBe("MEMBER");
      expect(userFromDb.address).toBe("Musterstraße 1, 12345 Musterstadt");
      expect(userFromDb.phone).toBe("+49 170 1234567");
      expect(userFromDb.activatedAt).not.toBeNull();
      await expect(compare(NEW_PASSWORD, userFromDb.password)).resolves.toBe(true);

      const invitationFromDb = await prisma.invitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(invitationFromDb.usedAt).not.toBeNull();

      expect((await login(invitation.email, NEW_PASSWORD)).status).toBe(200);
    });

    it("übernimmt die Rolle aus der Einladung", async () => {
      const { invitation, token } = await createInvitation({ role: "ADMIN" });

      expect((await redeemInvitation(token)).status).toBe(200);

      const userFromDb = await prisma.user.findUniqueOrThrow({
        where: { email: invitation.email },
      });
      expect(userFromDb.role).toBe("ADMIN");
    });

    it("lehnt die zweite Einlösung desselben Tokens mit 410 ab", async () => {
      const { invitation, token } = await createInvitation();

      expect((await redeemInvitation(token)).status).toBe(200);

      const secondUse = await redeemInvitation(token, { name: "Zweiter Versuch" });

      expect(secondUse.status).toBe(410);
      await expect(secondUse.json()).resolves.toMatchObject({
        error: "Einladung ist abgelaufen",
      });

      const users = await prisma.user.findMany({ where: { email: invitation.email } });
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe("Erika Musterfrau");
    });

    it("lehnt abgelaufene Einladungen mit 410 ab und legt keinen Benutzer an", async () => {
      const { invitation, token } = await createInvitation({
        expiresAt: new Date(Date.now() - 60_000),
      });

      const response = await redeemInvitation(token);

      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toMatchObject({
        error: "Einladung ist abgelaufen",
      });

      const userFromDb = await prisma.user.findUnique({
        where: { email: invitation.email },
      });
      expect(userFromDb).toBeNull();
    });

    it("lehnt bereits eingelöste Einladungen mit 410 ab und legt keinen Benutzer an", async () => {
      const { invitation, token } = await createInvitation({ usedAt: new Date() });

      const response = await redeemInvitation(token);

      expect(response.status).toBe(410);

      const userFromDb = await prisma.user.findUnique({
        where: { email: invitation.email },
      });
      expect(userFromDb).toBeNull();
    });

    it("lehnt unbekannte Token mit 404 ab", async () => {
      const response = await redeemInvitation("voellig-unbekannter-token");

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: "Einladung ungültig",
      });
    });

    it("erzwingt die Serverregeln für Name, Adresse und Telefon", async () => {
      const { invitation, token } = await createInvitation();

      const invalidName = await redeemInvitation(token, { name: "Max123" });
      expect(invalidName.status).toBe(400);
      await expect(invalidName.json()).resolves.toMatchObject({
        fieldErrors: [{ field: "name", message: "Name enthält ungültige Zeichen" }],
      });

      const invalidAddress = await redeemInvitation(token, { address: "x".repeat(201) });
      expect(invalidAddress.status).toBe(400);
      await expect(invalidAddress.json()).resolves.toMatchObject({
        fieldErrors: [{ field: "address", message: expect.stringContaining("maximal 200") }],
      });

      const invalidPhone = await redeemInvitation(token, { phone: "keine Nummer" });
      expect(invalidPhone.status).toBe(400);
      await expect(invalidPhone.json()).resolves.toMatchObject({
        fieldErrors: [{ field: "phone", message: expect.stringContaining("ungültige Zeichen") }],
      });

      // Nach reinen Validierungsfehlern bleibt die Einladung unverbraucht
      // und es wurde kein Benutzer angelegt.
      const invitationFromDb = await prisma.invitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(invitationFromDb.usedAt).toBeNull();
      await expect(
        prisma.user.findUnique({ where: { email: invitation.email } })
      ).resolves.toBeNull();
    });

    it("lehnt schwache und nicht übereinstimmende Passwörter mit 400 ab", async () => {
      const { invitation, token } = await createInvitation();

      const weak = await redeemInvitation(token, { password: "kurz", confirmPassword: "kurz" });
      expect(weak.status).toBe(400);

      const mismatch = await redeemInvitation(token, { confirmPassword: "AnderesPasswort1" });
      expect(mismatch.status).toBe(400);
      await expect(mismatch.json()).resolves.toMatchObject({
        error: "Passwörter stimmen nicht überein",
      });

      await expect(
        prisma.user.findUnique({ where: { email: invitation.email } })
      ).resolves.toBeNull();
    });

    it("aktualisiert ein Bestandskonto statt ein zweites anzulegen", async () => {
      const user = await createUser();
      const { invitation, token } = await createInvitation({ email: user.email });

      const response = await redeemInvitation(token, { name: "Neuer Name" });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        message: "Konto wurde aktualisiert",
      });

      const users = await prisma.user.findMany({ where: { email: user.email } });
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe(user.id);
      expect(users[0].name).toBe("Neuer Name");
      await expect(compare(NEW_PASSWORD, users[0].password)).resolves.toBe(true);

      const invitationFromDb = await prisma.invitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(invitationFromDb.usedAt).not.toBeNull();
    });
  });

  describe("Admin-Einladungserstellung", () => {
    it("lehnt Aufrufe ohne Session mit 401 ab", async () => {
      const response = await createAdminInvitation("ohne-session@example.com");

      expect(response.status).toBe(401);
    });

    it("legt als Admin eine Einladung an und reiht die E-Mail als OutgoingEmail ein", async () => {
      const admin = await createAdmin();
      loginAs(admin);

      const response = await createAdminInvitation("frisch-eingeladen@example.com");

      expect(response.status).toBe(200);

      const invitations = await prisma.invitation.findMany({
        where: { email: "frisch-eingeladen@example.com" },
      });
      expect(invitations).toHaveLength(1);
      expect(invitations[0].usedAt).toBeNull();
      expect(invitations[0].invitedById).toBe(admin.id);
      expect(invitations[0].expiresAt.getTime()).toBeGreaterThan(Date.now());

      const queuedEmails = await prisma.outgoingEmail.findMany({
        where: {
          template: "einladung-zur-rag-mse",
          toRecipients: "frisch-eingeladen@example.com",
        },
      });
      expect(queuedEmails).toHaveLength(1);
      expect(queuedEmails[0].status).toBe("QUEUED");
    });

    it("entwertet beim erneuten Einladen die vorherige aktive Einladung derselben E-Mail", async () => {
      const admin = await createAdmin();
      loginAs(admin);

      expect((await createAdminInvitation("doppelt-eingeladen@example.com")).status).toBe(200);
      expect((await createAdminInvitation("doppelt-eingeladen@example.com")).status).toBe(200);

      const invitations = await prisma.invitation.findMany({
        where: { email: "doppelt-eingeladen@example.com" },
        orderBy: { createdAt: "asc" },
      });
      expect(invitations).toHaveLength(2);

      const active = invitations.filter((invitation) => invitation.usedAt === null);
      expect(active).toHaveLength(1);
    });

    it("verweigert Einladungen für bereits existierende Benutzer mit 409", async () => {
      const admin = await createAdmin();
      loginAs(admin);
      const user = await createUser();

      const response = await createAdminInvitation(user.email);

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: "Ein Benutzer mit dieser E-Mail existiert bereits",
      });

      const invitations = await prisma.invitation.findMany({ where: { email: user.email } });
      expect(invitations).toHaveLength(0);
    });
  });
});
