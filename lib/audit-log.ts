import { logInfo, maskEmail } from "@/lib/logger";

interface AuditActor {
  id: string;
  email?: string | null;
  role?: string;
  impersonatedBy?: { id: string } | null;
}

export function logAdminAction(
  action: string,
  actor: AuditActor,
  details: Record<string, unknown> = {}
) {
  logInfo(`audit:${action}`, `Admin action: ${action}`, {
    adminId: actor.id,
    adminEmail: actor.email ? maskEmail(actor.email) : undefined,
    adminRole: actor.role,
    impersonatedById: actor.impersonatedBy?.id,
    ...details,
  });
}
