import type { User } from "@prisma/client";
import { GET as listAbsenceOwners } from "@/app/api/abwesenheiten/benutzer/route";
import { loginAs, logout } from "./helpers/auth";
import { createAdmin, createAuditor, createSiteAdministrator, createUser } from "./helpers/factories";

let admin: User;
let auditor: User;
let member: User;
let siteAdministrator: User;

beforeAll(async () => {
  admin = await createAdmin({ name: "Anna Admin" });
  auditor = await createAuditor({ name: "Paul Prüfer" });
  member = await createUser({ name: "Zacharias Zander" });
  siteAdministrator = await createSiteAdministrator({ name: "Sven System" });
  await createUser({ name: "Ärmel Ältester" });
  await createUser({ name: "Ina Eingeladen", activatedAt: null });
});

describe("Benutzerliste für Abwesenheiten (GET /api/abwesenheiten/benutzer)", () => {
  it.each([
    ["Administrator", () => admin],
    ["Seitenadministrator", () => siteAdministrator],
  ])("%s erhält aktivierte Benutzer nach Name sortiert, nur mit id und Name", async (_role, getUser) => {
    loginAs(getUser());

    const response = await listAbsenceOwners();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const { users } = await response.json();
    expect(users.map((user: { name: string }) => user.name)).toEqual([
      "Anna Admin",
      "Ärmel Ältester",
      "Paul Prüfer",
      "Sven System",
      "Zacharias Zander",
    ]);
    expect(users.find((user: { id: string }) => user.id === member.id)).toEqual({ id: member.id, name: "Zacharias Zander" });
    for (const user of users) expect(Object.keys(user).sort()).toEqual(["id", "name"]);
  });

  it.each([
    ["Prüfer", () => auditor],
    ["Mitglied", () => member],
  ])("%s erhält 403", async (_role, getUser) => {
    loginAs(getUser());
    expect((await listAbsenceOwners()).status).toBe(403);
  });

  it("weist anonyme Zugriffe mit 401 ab", async () => {
    logout();
    expect((await listAbsenceOwners()).status).toBe(401);
  });
});
