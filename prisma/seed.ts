import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hash } from "bcryptjs";
import { validatePassword } from "../lib/password-validation";

let prisma: PrismaClient;

function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const databaseUrl = process.env.DATABASE_URL ?? "file:./data/dev.db";
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
const DEFAULT_ADMIN_EMAIL = "admin@rag-mse.de";
const DEFAULT_ADMIN_PASSWORD = "AdminPass123";
const DEFAULT_ADMIN_NAME = "Administrator";
const ADMIN_ROLE: Role = "ADMIN";

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function getAdminCredentials(): Promise<{
  email: string;
  password: string;
  name: string;
}> {
  const isProduction = process.env.NODE_ENV === "production";
  const email = process.env.SEED_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || DEFAULT_ADMIN_NAME;

  if (isProduction && (!email || !password || !name)) {
    throw new Error("SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD und SEED_ADMIN_NAME sind in Produktion erforderlich");
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

  const {
    email: adminEmail,
    password: adminPassword,
    name: adminName,
  } = await getAdminCredentials();

  const existingAdmin = await prismaClient.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
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
        role: ADMIN_ROLE,
      },
    });

    console.log("Admin user created successfully:");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Role: ${admin.role}`);
    console.log("");
    console.log("WARNING: Please change the admin password after first login!");
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
