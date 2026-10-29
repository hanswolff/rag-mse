"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Permissions } from "./permissions";
import type { User } from "@/types";

// Startet eine Impersonierung aus der Benutzerverwaltung: Proof vom Server
// holen, Session damit aktualisieren und zum Profil des Benutzers wechseln.
export function useImpersonation() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [impersonationError, setImpersonationError] = useState("");
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

  const isSiteAdministrator = session ? Permissions.isSiteAdministrator(session.user) : false;

  const canImpersonateUser = (user: User) => isSiteAdministrator && session?.user?.id !== user.id;

  const handleImpersonate = async (user: User) => {
    setImpersonationError("");
    setImpersonatingUserId(user.id);
    try {
      if (typeof update !== "function") {
        setImpersonationError("Impersonierung ist derzeit nicht verfügbar");
        return;
      }
      const response = await fetch(`/api/admin/users/${user.id}/impersonate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || typeof data.proof !== "string") {
        setImpersonationError(data.error || "Impersonierung konnte nicht gestartet werden");
        return;
      }
      const updatedSession = await update({ impersonationStartProof: data.proof });
      if (!updatedSession?.user?.id || updatedSession.user.id !== user.id) {
        setImpersonationError("Impersonierung konnte nicht gestartet werden");
        return;
      }
      router.push("/profil");
      router.refresh();
    } catch {
      setImpersonationError("Impersonierung konnte nicht gestartet werden");
    } finally {
      setImpersonatingUserId(null);
    }
  };

  return { impersonationError, impersonatingUserId, canImpersonateUser, handleImpersonate };
}
