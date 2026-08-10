import { readdirSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { GET as getHealth } from "@/app/api/health/route";
import { PUT as updateProfile } from "@/app/api/user/profile/route";
import { apiRequest } from "./helpers/api";
import { loginAs } from "./helpers/auth";
import { createUser } from "./helpers/factories";

describe("Integrationsschicht: Infrastruktur (Pilot)", () => {
  it("wendet alle Migrationen auf die frische SQLite an", async () => {
    const migrationDirs = readdirSync(path.join(process.cwd(), "prisma", "migrations"), {
      withFileTypes: true,
    }).filter((entry) => entry.isDirectory());

    const applied = await prisma.appMigration.count();

    expect(migrationDirs.length).toBeGreaterThan(0);
    expect(applied).toBe(migrationDirs.length);
  });

  it("beantwortet /api/health gegen die echte Datenbank", async () => {
    const response = await getHealth();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok" });
  });

  it("schreibt über die echte Profil-Route in die echte Datenbank", async () => {
    const user = await createUser();
    loginAs(user);

    const response = await updateProfile(
      apiRequest("PUT", "/api/user/profile", { body: { name: "Geänderter Name" } })
    );

    expect(response.status).toBe(200);
    const fromDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fromDb.name).toBe("Geänderter Name");
  });

  it("lehnt Schreibzugriffe ohne Session mit 401 ab", async () => {
    const response = await updateProfile(
      apiRequest("PUT", "/api/user/profile", { body: { name: "Fremder Name" } })
    );

    expect(response.status).toBe(401);
  });
});
