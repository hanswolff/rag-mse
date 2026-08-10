import bcrypt from "bcryptjs";
import type { Event, Invitation, PasswordReset, Poll, PollOption, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateInvitationToken, getInvitationExpiryDate, hashInvitationToken } from "@/lib/invitations";
import { generatePollId } from "@/lib/poll-utils";
import { generateResetToken, getResetExpiryDate, hashResetToken } from "@/lib/password-reset";

// Persistierende Factories: legen echte Datensätze in der Test-SQLite an
// (anders als __tests__/helpers/factories.ts, das nur Mock-Objekte baut).

export const TEST_PASSWORD = "Integration1234!";
// Niedriger Kostenfaktor: die Routen vergleichen gegen den gespeicherten Hash,
// unabhängig davon, mit welchen Kosten er erzeugt wurde.
export const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

let sequence = 0;

function nextSequence(): number {
  sequence += 1;
  return sequence;
}

type UserOverrides = Partial<Parameters<typeof prisma.user.create>[0]["data"]>;

export async function createUser(overrides: UserOverrides = {}): Promise<User> {
  const seq = nextSequence();
  return prisma.user.create({
    data: {
      email: `benutzer-${seq}@example.com`,
      password: TEST_PASSWORD_HASH,
      name: `Testbenutzer ${seq}`,
      role: "MEMBER",
      activatedAt: new Date(),
      ...overrides,
    },
  });
}

export function createAdmin(overrides: UserOverrides = {}): Promise<User> {
  return createUser({ role: "ADMIN", ...overrides });
}

export function createAuditor(overrides: UserOverrides = {}): Promise<User> {
  return createUser({ role: "AUDITOR", ...overrides });
}

export function createSiteAdministrator(overrides: UserOverrides = {}): Promise<User> {
  return createUser({ role: "SITE_ADMINISTRATOR", ...overrides });
}

type EventOverrides = Partial<Parameters<typeof prisma.event.create>[0]["data"]>;

export async function createEvent(overrides: EventOverrides = {}): Promise<Event> {
  const seq = nextSequence();
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return prisma.event.create({
    data: {
      date,
      timeFrom: "10:00",
      timeTo: "12:00",
      location: `Schießstand ${seq}`,
      description: `Testtermin ${seq}`,
      ...overrides,
    },
  });
}

interface PollFactoryOptions {
  status?: "DRAFT" | "LIVE" | "CLOSED";
  multipleChoice?: boolean;
  optionTexts?: string[];
  createdById?: string;
}

export async function createPoll(
  options: PollFactoryOptions = {}
): Promise<Poll & { options: PollOption[] }> {
  const seq = nextSequence();
  const { status = "DRAFT", multipleChoice = false, optionTexts = ["Option A", "Option B"], createdById } = options;

  // Wie die Erstellungsroute: 8-stellige Kurz-ID statt cuid-Default.
  const poll = await prisma.poll.create({
    data: {
      id: generatePollId(),
      title: `Testumfrage ${seq}`,
      type: "SONSTIGES",
      status,
      multipleChoice,
      createdById,
      options: {
        create: optionTexts.map((text, position) => ({ text, position })),
      },
    },
    include: { options: { orderBy: { position: "asc" } } },
  });

  if (status === "DRAFT") {
    return poll;
  }

  // Die Publish-Route setzt shortCode = poll.id; die Factory bildet das nach.
  return prisma.poll.update({
    where: { id: poll.id },
    data: { shortCode: poll.id },
    include: { options: { orderBy: { position: "asc" } } },
  });
}

interface InvitationFactoryOptions {
  email?: string;
  role?: "ADMIN" | "AUDITOR" | "MEMBER";
  expiresAt?: Date;
  usedAt?: Date | null;
  invitedById?: string;
}

export async function createInvitation(
  options: InvitationFactoryOptions = {}
): Promise<{ invitation: Invitation; token: string }> {
  const seq = nextSequence();
  const token = generateInvitationToken();
  const invitation = await prisma.invitation.create({
    data: {
      email: options.email ?? `eingeladen-${seq}@example.com`,
      tokenHash: hashInvitationToken(token),
      role: options.role ?? "MEMBER",
      expiresAt: options.expiresAt ?? getInvitationExpiryDate(),
      usedAt: options.usedAt ?? null,
      invitedById: options.invitedById,
    },
  });
  return { invitation, token };
}

interface PasswordResetFactoryOptions {
  email: string;
  expiresAt?: Date;
  usedAt?: Date | null;
}

export async function createPasswordReset(
  options: PasswordResetFactoryOptions
): Promise<{ passwordReset: PasswordReset; token: string }> {
  const token = generateResetToken();
  const passwordReset = await prisma.passwordReset.create({
    data: {
      email: options.email,
      tokenHash: hashResetToken(token),
      expiresAt: options.expiresAt ?? getResetExpiryDate(),
      usedAt: options.usedAt ?? null,
    },
  });
  return { passwordReset, token };
}
