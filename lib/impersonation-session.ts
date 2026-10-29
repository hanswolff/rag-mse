import type { JWT } from "next-auth/jwt";
import { prisma } from "./prisma";
import { logInfo, logWarn, maskToken } from "./logger";
import { verifyImpersonationStartProof, verifyImpersonationStopProof } from "./auth-proof";

// Entfernt alle identitätsbezogenen Felder aus dem Token, sodass NextAuth die Session verwirft.
export function invalidateToken<T extends object>(token: T): T {
  const cleared = { ...token } as Record<string, unknown>;
  delete cleared.id;
  delete cleared.sub;
  delete cleared.role;
  delete cleared.impersonatedById;
  delete cleared.impersonatedByRole;
  delete cleared.impersonatedByName;
  delete cleared.impersonatedByEmail;
  delete cleared.passwordUpdatedAt;
  return cleared as T;
}

export function readImpersonationProofs(sessionUpdatePayload: unknown): {
  impersonationStartProof: string;
  impersonationStopProof: string;
} {
  const updatePayload = sessionUpdatePayload as Record<string, unknown> | undefined;
  return {
    impersonationStartProof:
      typeof updatePayload?.impersonationStartProof === "string" ? updatePayload.impersonationStartProof : "",
    impersonationStopProof:
      typeof updatePayload?.impersonationStopProof === "string" ? updatePayload.impersonationStopProof : "",
  };
}

export async function applyImpersonationStart(token: JWT, impersonationStartProof: string): Promise<JWT> {
  const actorUserId = String(token.id || "");
  const verifiedStart = verifyImpersonationStartProof(impersonationStartProof, actorUserId);
  const alreadyImpersonating = Boolean((token as Record<string, unknown>).impersonatedById);

  if (!verifiedStart || token.role !== "SITE_ADMINISTRATOR" || alreadyImpersonating || verifiedStart.targetUserId === actorUserId) {
    logWarn("impersonation_start_denied", "Rejected impersonation start proof in JWT callback", {
      actorUserId,
      tokenRole: token.role,
      alreadyImpersonating,
      proofPreview: maskToken(impersonationStartProof),
    });
    return token;
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: verifiedStart.targetUserId },
    select: { id: true, role: true, name: true, email: true },
  });

  if (!targetUser) {
    logWarn("impersonation_start_target_missing", "Impersonation target missing during JWT update", {
      actorUserId,
      targetUserId: verifiedStart.targetUserId,
    });
    return token;
  }

  const actorName = typeof token.name === "string" ? token.name : "";
  const actorEmail = typeof token.email === "string" ? token.email : "";

  (token as Record<string, unknown>).impersonatedById = actorUserId;
  (token as Record<string, unknown>).impersonatedByRole = String(token.role || "");
  (token as Record<string, unknown>).impersonatedByName = actorName;
  (token as Record<string, unknown>).impersonatedByEmail = actorEmail;

  token.id = targetUser.id;
  token.role = targetUser.role;
  token.name = targetUser.name || "";
  token.email = targetUser.email;

  logInfo("impersonation_started", "User impersonation activated", {
    actorUserId,
    targetUserId: targetUser.id,
    targetRole: targetUser.role,
  });
  return token;
}

export function restoreActorIdentity(
  token: JWT,
  actorUser: { id: string; role: string; name: string | null; email: string }
): JWT {
  token.id = actorUser.id;
  token.role = actorUser.role;
  token.name = actorUser.name || "";
  token.email = actorUser.email;

  delete (token as Record<string, unknown>).impersonatedById;
  delete (token as Record<string, unknown>).impersonatedByRole;
  delete (token as Record<string, unknown>).impersonatedByName;
  delete (token as Record<string, unknown>).impersonatedByEmail;
  return token;
}

export async function applyImpersonationStop(token: JWT, impersonationStopProof: string): Promise<JWT> {
  const storedActorUserId = String((token as Record<string, unknown>).impersonatedById || "");
  const effectiveUserId = String(token.id || "");

  if (!storedActorUserId) {
    logWarn("impersonation_stop_denied", "Stop impersonation requested without active impersonation", {
      effectiveUserId,
      proofPreview: maskToken(impersonationStopProof),
    });
    return token;
  }

  const isValidStopProof = verifyImpersonationStopProof(
    impersonationStopProof,
    storedActorUserId,
    effectiveUserId
  );
  if (!isValidStopProof) {
    logWarn("impersonation_stop_denied", "Rejected impersonation stop proof in JWT callback", {
      storedActorUserId,
      effectiveUserId,
      proofPreview: maskToken(impersonationStopProof),
    });
    return token;
  }

  const actorUser = await prisma.user.findUnique({
    where: { id: storedActorUserId },
    select: { id: true, role: true, name: true, email: true },
  });

  if (!actorUser) {
    logWarn("impersonation_stop_actor_missing", "Original actor missing during impersonation stop; session invalidated", {
      storedActorUserId,
      effectiveUserId,
    });
    return invalidateToken(token);
  }

  restoreActorIdentity(token, actorUser);

  logInfo("impersonation_stopped", "User impersonation deactivated", {
    actorUserId: actorUser.id,
    previousEffectiveUserId: effectiveUserId,
  });
  return token;
}
