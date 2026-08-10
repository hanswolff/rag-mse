import { OutgoingEmailStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CheckVerdict, RegisteredCheck } from "../types";

const DATA_COMPONENT = "Stammdaten";
const EMAIL_QUEUE_COMPONENT = "E-Mail-Warteschlange";

/** A lock older than this is considered stuck rather than actively processing. */
const STUCK_PROCESSING_MS = 5 * 60 * 1000;

async function checkCriticalData(): Promise<CheckVerdict> {
  const [siteAdmins, userCount, rangeCount] = await Promise.all([
    prisma.user.count({ where: { role: Role.SITE_ADMINISTRATOR } }),
    prisma.user.count(),
    prisma.shootingRange.count(),
  ]);

  if (siteAdmins === 0) {
    return {
      status: "error",
      message: "Kein SITE_ADMINISTRATOR vorhanden – Anwendung ist nicht administrierbar",
      details: { siteAdmins, userCount, rangeCount },
    };
  }

  const warnings: string[] = [];
  if (rangeCount === 0) {
    warnings.push("Keine Standorte angelegt");
  }
  if (userCount <= siteAdmins) {
    warnings.push("Keine Mitglieder außer Administratoren vorhanden");
  }

  if (warnings.length > 0) {
    return {
      status: "warn",
      message: warnings.join("; "),
      details: { siteAdmins, userCount, rangeCount },
    };
  }

  return {
    status: "ok",
    message: `${siteAdmins} Administrator(en), ${userCount} Benutzer, ${rangeCount} Standorte`,
    details: { siteAdmins, userCount, rangeCount },
  };
}

async function checkEmailQueueHealth(): Promise<CheckVerdict> {
  const now = new Date();
  const [failed, stuck] = await Promise.all([
    prisma.outgoingEmail.count({ where: { status: OutgoingEmailStatus.FAILED } }),
    prisma.outgoingEmail.count({
      where: {
        status: OutgoingEmailStatus.PROCESSING,
        lockedUntil: { lt: new Date(now.getTime() - STUCK_PROCESSING_MS) },
      },
    }),
  ]);

  if (failed > 0 || stuck > 0) {
    const parts: string[] = [];
    if (failed > 0) parts.push(`${failed} dauerhaft fehlgeschlagene E-Mail(s)`);
    if (stuck > 0) parts.push(`${stuck} festhängende E-Mail(s) in Verarbeitung`);
    return {
      status: "warn",
      message: parts.join("; "),
      details: { failed, stuck },
    };
  }

  return { status: "ok", message: "Keine fehlgeschlagenen oder festhängenden E-Mails", details: { failed, stuck } };
}

export const dataPresenceChecks: RegisteredCheck[] = [
  { name: "data.critical", component: DATA_COMPONENT, run: checkCriticalData },
  { name: "data.email_queue", component: EMAIL_QUEUE_COMPONENT, run: checkEmailQueueHealth },
];
