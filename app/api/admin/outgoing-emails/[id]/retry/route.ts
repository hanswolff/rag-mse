import { OutgoingEmailStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { BadRequestError, validateCsrfHeaders, withApiErrorHandling } from "@/lib/api-utils";
import { processDueEmailOutboxBatch } from "@/lib/email-sender";
import { logError } from "@/lib/logger";

export const POST = withApiErrorHandling(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  validateCsrfHeaders(request);
  await requireAdmin();

  const { id } = await params;
  const email = await prisma.outgoingEmail.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!email) {
    return NextResponse.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  if (email.status !== OutgoingEmailStatus.FAILED) {
    throw new BadRequestError("Nur fehlgeschlagene E-Mails können erneut eingeplant werden.");
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
