import { randomBytes } from "crypto";
import { prisma } from "./prisma";

const POLL_ID_LENGTH = 8;
const POLL_ID_CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";
const MAX_COLLISION_RETRIES = 5;

export function generatePollId(): string {
  const bytes = randomBytes(POLL_ID_LENGTH);
  let id = "";
  for (let i = 0; i < POLL_ID_LENGTH; i++) {
    id += POLL_ID_CHARSET[bytes[i] % POLL_ID_CHARSET.length];
  }
  return id;
}

export async function generateUniquePollId(): Promise<string> {
  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
    const id = generatePollId();
    const existing = await prisma.poll.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return id;
  }
  throw new Error("Umfrage-ID-Generierung fehlgeschlagen nach mehreren Versuchen");
}

export const generateShortCode = generatePollId;
export const generateUniqueShortCode = generateUniquePollId;

export { getPollTypeLabel, getPollStatusLabel } from "./poll-labels";
