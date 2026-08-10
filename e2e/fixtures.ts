import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hash } from "bcryptjs";
import {
  E2E_ADMIN,
  E2E_MITGLIED,
  E2E_TERMIN,
  E2E_UMFRAGE,
  terminDatumInZukunft,
} from "./testdaten";

const BCRYPT_SALT_ROUNDS = 10;

// Seedet die Wegwerf-Datenbank der E2E-Suite: je ein aktiviertes Admin- und
// Mitgliedskonto, ein sichtbarer zukünftiger Termin und eine LIVE-Umfrage
// mit zwei Optionen (shortCode = poll.id, wie es die Publish-Route setzt).
export async function seedE2eFixtures(databaseUrl: string): Promise<void> {
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const now = new Date();

    await prisma.user.create({
      data: {
        email: E2E_ADMIN.email,
        password: await hash(E2E_ADMIN.password, BCRYPT_SALT_ROUNDS),
        name: E2E_ADMIN.name,
        role: "ADMIN",
        activatedAt: now,
      },
    });

    await prisma.user.create({
      data: {
        email: E2E_MITGLIED.email,
        password: await hash(E2E_MITGLIED.password, BCRYPT_SALT_ROUNDS),
        name: E2E_MITGLIED.name,
        role: "MEMBER",
        activatedAt: now,
      },
    });

    await prisma.event.create({
      data: {
        title: E2E_TERMIN.title,
        date: terminDatumInZukunft(),
        timeFrom: E2E_TERMIN.timeFrom,
        timeTo: E2E_TERMIN.timeTo,
        location: E2E_TERMIN.location,
        description: E2E_TERMIN.description,
        visible: true,
      },
    });

    const poll = await prisma.poll.create({
      data: {
        // 8-stellige Kurz-ID wie aus generatePollId(), statt cuid-Default
        id: "e2epoll1",
        title: E2E_UMFRAGE.title,
        description: E2E_UMFRAGE.description,
        type: "SONSTIGES",
        status: "LIVE",
        options: {
          create: [
            { text: E2E_UMFRAGE.optionA, position: 0 },
            { text: E2E_UMFRAGE.optionB, position: 1 },
          ],
        },
      },
    });

    await prisma.poll.update({
      where: { id: poll.id },
      data: { shortCode: poll.id },
    });
  } finally {
    await prisma.$disconnect();
  }
}
