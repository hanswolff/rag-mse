import path from "node:path";
import { rename, stat } from "node:fs/promises";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hash } from "bcryptjs";
import { validatePassword } from "../lib/password-validation";
import { adoptAusschreibungFile } from "../lib/ausschreibung-storage";

void import("dotenv/config").catch(() => undefined);

let prisma: PrismaClient;

function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const databaseUrl = process.env.DATABASE_URL ?? "file:./data/prod.db";
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    prisma = new PrismaClient({
      adapter,
      log: [
        { emit: "stdout", level: "warn" },
        { emit: "stdout", level: "error" },
      ],
    });
  }
  return prisma;
}

const BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_ADMIN_NAME = "Administrator";
const INITIAL_ADMIN_ROLE: Role = "SITE_ADMINISTRATOR";
const PLACEHOLDER_PREFIXES = ["CHANGE_ME", "YOUR_"];

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function getAdminCredentials(): Promise<{
  email: string;
  password: string;
  name: string;
} | null> {
  const isProduction = process.env.NODE_ENV === "production";
  const seedEnabledInProduction = isProduction && process.env.ALLOW_DB_SEED === "true";
  const rawEmail = process.env.SEED_ADMIN_EMAIL;
  const rawPassword = process.env.SEED_ADMIN_PASSWORD;
  const rawName = process.env.SEED_ADMIN_NAME;

  if (!rawEmail?.trim() || !rawPassword?.trim()) {
    console.warn("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set. Skipping admin user seeding.");
    return null;
  }

  if (seedEnabledInProduction) {
    if (!rawName?.trim()) {
      throw new Error("SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD und SEED_ADMIN_NAME müssen für ALLOW_DB_SEED=true in Produktion explizit gesetzt sein");
    }
  }

  const email = rawEmail;
  const password = rawPassword;
  const name = rawName || DEFAULT_ADMIN_NAME;

  if (isProduction && (!email || !password || !name)) {
    throw new Error("SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD und SEED_ADMIN_NAME sind in Produktion erforderlich");
  }

  if (seedEnabledInProduction) {
    const usesPlaceholderPassword = PLACEHOLDER_PREFIXES.some((prefix) => password.startsWith(prefix));
    if (usesPlaceholderPassword) {
      throw new Error("SEED_ADMIN_PASSWORD muss in Produktion explizit gesetzt sein und darf kein Standard- oder Platzhalterwert sein");
    }
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!validateEmail(normalizedEmail)) {
    throw new Error(`Invalid email format: ${normalizedEmail}`);
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    throw new Error(passwordValidation.errors.join(", "));
  }

  return { email: normalizedEmail, password, name };
}

export async function main(prismaOverride?: PrismaClient) {
  const prismaClient = prismaOverride || getPrismaClient();

  console.log("Starting database seed...");

  const credentials = await getAdminCredentials();

  if (credentials) {
    const { email: adminEmail, password: adminPassword, name: adminName } = credentials;

    const existingAdmin = await prismaClient.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      if (existingAdmin.role === "ADMIN") {
        await prismaClient.user.update({
          where: { id: existingAdmin.id },
          data: { role: INITIAL_ADMIN_ROLE },
        });
        console.log(`Existing admin user ${adminEmail} upgraded to role ${INITIAL_ADMIN_ROLE}.`);
      }
      console.log(
        `Admin user with email ${adminEmail} already exists. Skipping creation.`
      );
    } else {
      const hashedPassword = await hash(adminPassword, BCRYPT_SALT_ROUNDS);

      const admin = await prismaClient.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: adminName,
          role: INITIAL_ADMIN_ROLE,
        },
      });

      console.log("Admin user created successfully:");
      console.log(`   Email: ${admin.email}`);
      console.log(`   Name: ${admin.name}`);
      console.log(`   Role: ${admin.role}`);
      console.log("");
      console.log("WARNING: Please change the admin password after first login!");
    }
  }

  const shootingRanges = [
    {
      name: "Schützenverein Grischow 1894/1992",
      street: "Oberstriet 2",
      postalCode: "17089",
      city: "Grischow",
      latitude: 53.69290860350169,
      longitude: 13.335883820165746,
    },
    {
      name: "Schützenverein \"Vier Tore\" e.V.",
      street: "Zur Datze 15",
      postalCode: "17034",
      city: "Neubrandenburg",
      latitude: 53.57030963967344,
      longitude: 13.305432186507492,
    },
    {
      name: "Privilegierte Schützengesellschaft zu Güstrow e.V.",
      street: "Koppelweg 12b",
      postalCode: "18273",
      city: "Güstrow",
      latitude: 53.80972484274375,
      longitude: 12.239689271164167,
    },
    {
      name: "Schützengesellschaft 1884 der Reuterstadt Stavenhagen e.V.",
      street: "Stadtholz 4a",
      postalCode: "17153",
      city: "Stavenhagen",
      latitude: 53.70109808691019,
      longitude: 12.924401412887129,
    },
    {
      name: "Schießstand Fürstensee",
      street: null,
      postalCode: "17235",
      city: "Neustrelitz",
      latitude: 53.29723665039616,
      longitude: 13.125446177664209,
    },
    {
      name: "Schützenverein Burg Stargard",
      street: null,
      postalCode: "17094",
      city: "Burg Stargard",
      latitude: 53.499856125744394,
      longitude: 13.347091976262474,
    },
    {
      name: "Schützenzunft Waren Müritz e.V. Schießstand",
      street: "Kargower Weg 5",
      postalCode: "17192",
      city: "Waren (Müritz)",
      latitude: 53.50487941974799,
      longitude: 12.721974213492508,
    },
    {
      name: "Schießstand Wittstock",
      street: "Weg zur Schäferei 2",
      postalCode: "16909",
      city: "Wittstock/Dosse",
      latitude: 53.222420789586586,
      longitude: 12.559584655191628,
    },
    {
      name: "Schützengilde Neustrelitz 1767 e.V.",
      street: "Pappelallee 19",
      postalCode: "17235",
      city: "Neustrelitz",
      latitude: 53.35090444848738,
      longitude: 13.055526434111679,
    },
    {
      name: "Marinetechnikschule Parow",
      street: "Schießplatz der Bundeswehr, Pappelallee 24",
      postalCode: "18445",
      city: "Kramerhof",
      latitude: 54.37460430504266,
      longitude: 13.082525704380235,
    },
  ];

  for (const range of shootingRanges) {
    await prismaClient.shootingRange.upsert({
      where: { name: range.name },
      update: {
        street: range.street,
        postalCode: range.postalCode,
        city: range.city,
        latitude: range.latitude,
        longitude: range.longitude,
      },
      create: range,
    });
  }

  console.log(`Schießstände synchronisiert: ${shootingRanges.length}`);

  await seedLandesmeisterschaftAusschreibung(prismaClient);
}

const LANDESMEISTERSCHAFT_TITLE = "Landesmeisterschaft Schießsport";
const LANDESMEISTERSCHAFT_EXPIRES_AT = new Date(Date.UTC(2026, 7, 1));
const LANDESMEISTERSCHAFT_SOURCE_FILE = "2026-08-01_Ausschreibung_Landesmeisterschaft_Schießsport.pdf";

async function seedLandesmeisterschaftAusschreibung(prismaClient: PrismaClient): Promise<void> {
  const existing = await prismaClient.ausschreibung.findFirst({
    where: { title: LANDESMEISTERSCHAFT_TITLE },
  });

  if (existing) {
    console.log(`Ausschreibung "${LANDESMEISTERSCHAFT_TITLE}" existiert bereits. Überspringe Seed.`);
    return;
  }

  const sourcePath = path.join(process.cwd(), "data", LANDESMEISTERSCHAFT_SOURCE_FILE);
  const adopted = await adoptAusschreibungFile(sourcePath);

  if (!adopted) {
    console.warn(
      `Quelldatei für Ausschreibungs-Seed nicht gefunden (${sourcePath}). Überspringe Seed.`
    );
    return;
  }

  const { size: sizeBytes } = await stat(adopted.filePath);

  try {
    await prismaClient.ausschreibung.create({
      data: {
        title: LANDESMEISTERSCHAFT_TITLE,
        expiresAt: LANDESMEISTERSCHAFT_EXPIRES_AT,
        originalFileName: LANDESMEISTERSCHAFT_SOURCE_FILE,
        storedFileName: adopted.storedFileName,
        mimeType: "application/pdf",
        sizeBytes,
      },
    });
  } catch (error) {
    try {
      await rename(adopted.filePath, sourcePath);
    } catch (renameError) {
      console.error(
        `Konnte adoptierte Datei nach fehlgeschlagenem Seed nicht zurückverschieben (${adopted.filePath} -> ${sourcePath}):`,
        renameError
      );
    }
    throw error;
  }

  console.log(`Ausschreibung "${LANDESMEISTERSCHAFT_TITLE}" angelegt.`);
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await getPrismaClient().$disconnect();
  }
}

if (require.main === module) {
  run();
}
