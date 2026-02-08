import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateEmail } from "@/lib/user-validation";
import { parseJsonBody, BadRequestError, logApiError, validateRequestBody, validateCsrfHeaders } from "@/lib/api-utils";
import { logValidationFailure } from "@/lib/logger";
import {
  buildInviteUrl,
  generateInvitationToken,
  getInvitationExpiryDate,
  hashInvitationToken,
  sendInvitationEmail,
} from "@/lib/invitations";

interface InviteRequest {
  email: string;
}

const inviteSchema = {
  email: { type: 'string' as const },
} as const;

const INVITED_AT_EPOCH = new Date("1970-01-01T00:00:00.000Z");

export async function POST(request: NextRequest) {
  try {
    validateCsrfHeaders(request);

    const admin = await requireAdmin();
    const body = await parseJsonBody<InviteRequest>(request);

    const bodyValidation = validateRequestBody(body as unknown as Record<string, unknown>, inviteSchema, { route: '/api/admin/invitations', method: 'POST' });
    if (!bodyValidation.isValid) {
      return NextResponse.json(
        { error: bodyValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !validateEmail(email)) {
      logValidationFailure('/api/admin/invitations', 'POST', 'Ungültiges E-Mail-Format', {
        email: body.email,
      });
      return NextResponse.json(
        { error: "Ungültiges E-Mail-Format" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ein Benutzer mit dieser E-Mail existiert bereits" },
        { status: 409 }
      );
    }

    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      logApiError(new Error("APP_URL ist nicht konfiguriert"), {
        route: "/api/admin/invitations",
        method: "POST",
        status: 500,
      });
      return NextResponse.json(
        { error: "APP_URL ist nicht konfiguriert" },
        { status: 500 }
      );
    }

    const token = generateInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = getInvitationExpiryDate();

    const invitation = await prisma.$transaction(async (tx: Omit<typeof prisma, "\$connect" | "\$disconnect" | "\$on" | "\$transaction" | "\$extends">) => {
      await tx.invitation.updateMany({
        where: {
          email,
          usedAt: null,
        },
        data: {
          usedAt: INVITED_AT_EPOCH,
        },
      });

      return tx.invitation.create({
        data: {
          email,
          tokenHash,
          expiresAt,
          invitedById: admin.id,
        },
      });
    });

    const inviteUrl = buildInviteUrl(appUrl, token);

    const result = await sendInvitationEmail({
      email,
      inviteUrl,
      logContext: {
        route: "/api/admin/invitations",
        method: "POST",
        invitationId: invitation.id,
        ...(admin.email && { userEmail: admin.email }),
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Einladung wurde erfolgreich erstellt und versendet." },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json(
        { error: "Nicht autorisiert" },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}
