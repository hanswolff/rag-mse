import type { JWT } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authOptions, authorizeCredentials } from "@/lib/auth-config";
import { createImpersonationStartProof, createPasswordChangeProof } from "@/lib/auth-proof";
import { PATCH as patchUser, DELETE as deleteUserRoute } from "@/app/api/admin/users/[id]/route";
import { PUT as changePasswordRoute } from "@/app/api/user/change-password/route";
import { POST as redeemInvitationRoute } from "@/app/api/invitations/[token]/route";
import { apiRequest, routeContext } from "./helpers/api";
import { loginAs } from "./helpers/auth";
import {
  TEST_PASSWORD,
  createAdmin,
  createInvitation,
  createSiteAdministrator,
  createUser,
} from "./helpers/factories";

const NEUES_PASSWORT = "NeuesPasswort1";

type JwtParams = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>["jwt"]>>[0];

async function runJwt(params: Partial<JwtParams> & { token: JWT }): Promise<JWT> {
  return authOptions.callbacks!.jwt!({
    user: undefined as never,
    account: null,
    profile: undefined,
    trigger: undefined,
    isNewUser: false,
    session: undefined,
    ...params,
  } as JwtParams);
}

async function tokenNachLogin(user: User): Promise<JWT> {
  const authUser = await authorizeCredentials(
    { email: user.email, password: TEST_PASSWORD },
    { headers: {}, ip: "203.0.113.50" }
  );
  expect(authUser).not.toBeNull();
  return runJwt({
    token: { email: user.email, sub: user.id } as JWT,
    user: authUser as never,
    trigger: "signIn",
  });
}

function passwortAendern(user: User) {
  loginAs(user);
  return changePasswordRoute(
    apiRequest("PUT", "/api/user/change-password", {
      body: { currentPassword: TEST_PASSWORD, newPassword: NEUES_PASSWORT, confirmPassword: NEUES_PASSWORT },
    })
  );
}

function redeemInvitation(token: string) {
  return redeemInvitationRoute(
    apiRequest("POST", `/api/invitations/${token}`, {
      body: {
        name: "Erika Musterfrau",
        address: "Musterstraße 1, 12345 Musterstadt",
        phone: "+49 170 1234567",
        password: NEUES_PASSWORT,
        confirmPassword: NEUES_PASSWORT,
      },
    }),
    routeContext({ token })
  );
}

describe("Offene Einladungen bei Löschen und E-Mail-Änderung", () => {
  it("entwertet beim Löschen eines Benutzers dessen offene Einladung", async () => {
    const admin = await createAdmin();
    await createAdmin();
    const falschAngelegt = await createAdmin({ email: "tippfehler@example.com", activatedAt: null });
    const { invitation, token } = await createInvitation({ email: falschAngelegt.email, role: "ADMIN" });
    loginAs(admin);

    const response = await deleteUserRoute(
      apiRequest("DELETE", `/api/admin/users/${falschAngelegt.id}`),
      routeContext({ id: falschAngelegt.id })
    );

    expect(response.status).toBe(200);
    const fromDb = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(fromDb.usedAt).not.toBeNull();
    expect((await redeemInvitation(token)).status).toBe(410);
    expect(await prisma.user.findUnique({ where: { email: falschAngelegt.email } })).toBeNull();
  });

  it("entwertet bei einer E-Mail-Änderung die Einladungen der alten Adresse", async () => {
    const admin = await createAdmin();
    const benutzer = await createUser({ email: "alt@example.com", activatedAt: null });
    const alteEinladung = await createInvitation({ email: "alt@example.com" });
    const fremdeEinladung = await createInvitation({ email: "andere@example.com" });
    loginAs(admin);

    const response = await patchUser(
      apiRequest("PATCH", `/api/admin/users/${benutzer.id}`, { body: { email: "neu@example.com" } }),
      routeContext({ id: benutzer.id })
    );

    expect(response.status).toBe(200);
    const alt = await prisma.invitation.findUniqueOrThrow({ where: { id: alteEinladung.invitation.id } });
    const fremd = await prisma.invitation.findUniqueOrThrow({ where: { id: fremdeEinladung.invitation.id } });
    expect(alt.usedAt).not.toBeNull();
    expect(fremd.usedAt).toBeNull();
    expect((await redeemInvitation(alteEinladung.token)).status).toBe(410);
    expect(await prisma.user.findUnique({ where: { email: "alt@example.com" } })).toBeNull();
  });

  it("entwertet die normalisiert gespeicherte Einladung eines Bestandskontos mit Großbuchstaben", async () => {
    const admin = await createAdmin();
    const altKonto = await createUser({ email: "Alt.Konto@Example.com", activatedAt: null });
    const { invitation } = await createInvitation({ email: "alt.konto@example.com" });
    loginAs(admin);

    const response = await deleteUserRoute(
      apiRequest("DELETE", `/api/admin/users/${altKonto.id}`),
      routeContext({ id: altKonto.id })
    );

    expect(response.status).toBe(200);
    const fromDb = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(fromDb.usedAt).not.toBeNull();
  });

  it("lässt offene Einladungen unberührt, wenn die E-Mail gleich bleibt", async () => {
    const admin = await createAdmin();
    const benutzer = await createUser({ email: "gleich@example.com", activatedAt: null });
    const { invitation } = await createInvitation({ email: "gleich@example.com" });
    loginAs(admin);

    const response = await patchUser(
      apiRequest("PATCH", `/api/admin/users/${benutzer.id}`, { body: { name: "Neuer Name" } }),
      routeContext({ id: benutzer.id })
    );

    expect(response.status).toBe(200);
    const fromDb = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(fromDb.usedAt).toBeNull();
  });
});

describe("Sitzungen nach Passwortwechsel", () => {
  it("behält eine frische Sitzung bei unverändertem Passwort", async () => {
    const user = await createUser({ passwordUpdatedAt: new Date("2026-03-29T01:30:00.987Z") });
    const token = await tokenNachLogin(user);

    const refreshed = await runJwt({ token });

    expect(refreshed.id).toBe(user.id);
    expect(refreshed.passwordUpdatedAt).toBe(Date.parse("2026-03-29T01:30:00.987Z"));
  });

  it("behält die Sitzung eines Benutzers, der sein Passwort nie geändert hat", async () => {
    const user = await createUser();
    const token = await tokenNachLogin(user);

    expect(token.passwordUpdatedAt).toBeNull();
    expect((await runJwt({ token })).id).toBe(user.id);
  });

  it("beendet andere Sitzungen nach einem Passwortwechsel", async () => {
    const user = await createUser();
    const fremdeSitzung = await tokenNachLogin(user);

    expect((await passwortAendern(user)).status).toBe(200);

    const refreshed = await runJwt({ token: fremdeSitzung });
    expect(refreshed.id).toBeUndefined();
    expect(refreshed.sub).toBeUndefined();
  });

  it("beendet Sitzungen nach einem Passwort-Reset", async () => {
    const user = await createUser();
    const token = await tokenNachLogin(user);

    await prisma.user.update({ where: { id: user.id }, data: { passwordUpdatedAt: new Date() } });

    expect((await runJwt({ token })).id).toBeUndefined();
  });

  it("zieht die eigene Sitzung mit dem Passwortwechsel-Proof nach", async () => {
    const user = await createUser();
    const eigeneSitzung = await tokenNachLogin(user);

    const response = await passwortAendern(user);
    const { passwordChangeProof } = await response.json();
    expect(passwordChangeProof).toEqual(expect.stringMatching(/^v1p\./));

    const aktualisiert = await runJwt({
      token: eigeneSitzung,
      trigger: "update",
      session: { passwordChangeProof },
    });
    const fromDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    expect(aktualisiert.id).toBe(user.id);
    expect(aktualisiert.passwordUpdatedAt).toBe(fromDb.passwordUpdatedAt!.getTime());
    expect((await runJwt({ token: aktualisiert })).id).toBe(user.id);
  });

  it("verwirft einen Proof für einen veralteten Passwortstand oder ein fremdes Konto", async () => {
    const user = await createUser();
    const anderer = await createUser();
    const token = await tokenNachLogin(user);
    const alterStand = Date.now() - 60_000;
    await prisma.user.update({ where: { id: user.id }, data: { passwordUpdatedAt: new Date() } });
    const aktuell = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordUpdatedAt!.getTime();

    for (const proof of [
      createPasswordChangeProof(user.id, alterStand),
      createPasswordChangeProof(anderer.id, aktuell),
    ]) {
      const refreshed = await runJwt({ token: { ...token }, trigger: "update", session: { passwordChangeProof: proof } });
      expect(refreshed.id).toBeUndefined();
    }
  });

  function altTokenOhneStempel(user: User): JWT {
    return { id: user.id, sub: user.id, role: user.role, name: user.name, email: user.email } as JWT;
  }

  it("übernimmt Alt-Sitzungen ohne Stempel, wenn das Passwort nie geändert wurde", async () => {
    const user = await createUser();

    const refreshed = await runJwt({ token: altTokenOhneStempel(user) });

    expect(refreshed.id).toBe(user.id);
    expect(refreshed.passwordUpdatedAt).toBeNull();
    await prisma.user.update({ where: { id: user.id }, data: { passwordUpdatedAt: new Date() } });
    expect((await runJwt({ token: refreshed })).id).toBeUndefined();
  });

  it("beendet Alt-Sitzungen ohne Stempel, sobald ein Passwortwechsel gespeichert ist", async () => {
    const user = await createUser({ passwordUpdatedAt: new Date("2026-01-01T00:00:00.000Z") });
    const altToken = { ...altTokenOhneStempel(user), iat: Math.floor(Date.now() / 1000) } as JWT;

    expect((await runJwt({ token: altToken })).id).toBeUndefined();
  });
});

describe("Impersonierung: Nachprüfung des Site-Administrators", () => {
  async function impersonierendeSitzung() {
    const siteAdmin = await createSiteAdministrator();
    const ziel = await createUser();
    const token = await tokenNachLogin(siteAdmin);
    const impersoniert = await runJwt({
      token,
      trigger: "update",
      session: { impersonationStartProof: createImpersonationStartProof(siteAdmin.id, ziel.id) },
    });
    expect(impersoniert.id).toBe(ziel.id);
    expect(impersoniert.impersonatedById).toBe(siteAdmin.id);
    return { siteAdmin, ziel, token: impersoniert };
  }

  it("behält die Impersonierung, solange der Site-Administrator seine Rolle hat", async () => {
    const { ziel, token } = await impersonierendeSitzung();

    const refreshed = await runJwt({ token });

    expect(refreshed.id).toBe(ziel.id);
  });

  it("beendet die Impersonierung, wenn der Site-Administrator herabgestuft wird", async () => {
    const { siteAdmin, token } = await impersonierendeSitzung();
    await prisma.user.update({ where: { id: siteAdmin.id }, data: { role: "ADMIN" } });

    const refreshed = await runJwt({ token });

    expect(refreshed.id).toBe(siteAdmin.id);
    expect(refreshed.role).toBe("ADMIN");
    expect(refreshed.impersonatedById).toBeUndefined();
  });

  it("beendet die Sitzung, wenn der Site-Administrator sein Passwort ändert", async () => {
    const { siteAdmin, token } = await impersonierendeSitzung();
    await prisma.user.update({ where: { id: siteAdmin.id }, data: { passwordUpdatedAt: new Date() } });

    expect((await runJwt({ token })).id).toBeUndefined();
  });

  it("beendet die Sitzung, wenn der Site-Administrator gelöscht wird", async () => {
    const { siteAdmin, token } = await impersonierendeSitzung();
    await prisma.user.delete({ where: { id: siteAdmin.id } });

    expect((await runJwt({ token })).id).toBeUndefined();
  });

  it("ignoriert einen Passwortwechsel des Zielbenutzers", async () => {
    const { ziel, token } = await impersonierendeSitzung();
    await prisma.user.update({ where: { id: ziel.id }, data: { passwordUpdatedAt: new Date() } });

    expect((await runJwt({ token })).id).toBe(ziel.id);
  });
});

describe("Audit während Impersonierung", () => {
  it("schreibt den echten Akteur in den Audit-Eintrag", async () => {
    const siteAdmin = await createSiteAdministrator();
    const zielAdmin = await createAdmin();
    const benutzer = await createUser();
    jest.mocked(getServerSession).mockResolvedValue({
      user: {
        id: zielAdmin.id,
        email: zielAdmin.email,
        name: zielAdmin.name,
        role: zielAdmin.role,
        isImpersonating: true,
        impersonatedBy: { id: siteAdmin.id, role: siteAdmin.role, name: siteAdmin.name, email: siteAdmin.email },
      },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    } as never);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await patchUser(
      apiRequest("PATCH", `/api/admin/users/${benutzer.id}`, { body: { name: "Geändert" } }),
      routeContext({ id: benutzer.id })
    );

    expect(response.status).toBe(200);
    const auditZeile = logSpy.mock.calls.map((args) => String(args[0])).find((line) => line.includes("[audit:user_update]"));
    logSpy.mockRestore();
    expect(auditZeile).toContain(`"adminId":"${zielAdmin.id}"`);
    expect(auditZeile).toContain(`"impersonatedById":"${siteAdmin.id}"`);
  });
});
