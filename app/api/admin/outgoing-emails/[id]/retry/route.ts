import { OutgoingEmailStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { BadRequestError, validateCsrfHeaders, withApiErrorHandling } from "@/lib/api-utils";
import { processDueEmailOutboxBatch } from "@/lib/email-sender";
import { containsTokenPlaceholders } from "@/lib/email/redact";
import { PRUNED_ATTACHMENTS_MARKER } from "@/lib/email/types";
import { logError } from "@/lib/logger";

export const POST = withApiErrorHandling(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await params;
  const email = await prisma.outgoingEmail.findUnique({
    where: { id },
    select: { id: true, status: true, attachmentsJson: true, textBody: true, htmlBody: true, sensitiveTokensJson: true },
  });

  if (!email) {
    return NextResponse.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  if (email.status !== OutgoingEmailStatus.FAILED) {
    throw new BadRequestError("Nur fehlgeschlagene E-Mails können erneut eingeplant werden.");
  }

  if (email.attachmentsJson === PRUNED_ATTACHMENTS_MARKER) {
    throw new BadRequestError(
      "Diese E-Mail kann nicht erneut versendet werden: Ihre Anhänge wurden nach Ablauf der Aufbewahrungsfrist endgültig gelöscht."
    );
  }

  // Ohne die separat gespeicherten Einmal-Token würde der Versand die
  // Platzhalter (***TOKEN_n***) statt funktionierender Links ausliefern
  if (
    !email.sensitiveTokensJson &&
    (containsTokenPlaceholders(email.textBody) || containsTokenPlaceholders(email.htmlBody))
  ) {
    throw new BadRequestError(
      "Diese E-Mail kann nicht erneut versendet werden: Die enthaltenen Sicherheits-Links wurden nach Ablauf der Aufbewahrungsfrist endgültig entfernt."
    );
  }

  await prisma.outgoingEmail.update({
    where: { id: email.id },
    data: {
      status: OutgoingEmailStatus.RETRYING,
      nextAttemptAt: new Date(),
      lockedUntil: null,
      lastError: null,
    },
  });

  void processDueEmailOutboxBatch().catch((error) => {
    logError("admin_outgoing_email_retry_process_failed", "Failed to process outbox batch after manual retry enqueue", {
      outgoingEmailId: email.id,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return NextResponse.json({
    message: "E-Mail wurde für den erneuten Versand eingeplant.",
  });
}, { route: "/api/admin/outgoing-emails/[id]/retry", method: "POST" });
