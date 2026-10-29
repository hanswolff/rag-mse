"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { API_ROUTES } from "./api-routes";

// Beendet eine laufende Impersonierung: Proof vom Server holen, Session damit
// aktualisieren und zurück zur Benutzerverwaltung navigieren.
export function useStopImpersonation() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [isStoppingImpersonation, setIsStoppingImpersonation] = useState(false);
  const [impersonationError, setImpersonationError] = useState("");

  const isImpersonating = !!session?.user?.isImpersonating && !!session.user.impersonatedBy?.id;
  const impersonatedBy = session?.user?.impersonatedBy;

  const handleStopImpersonation = async () => {
    if (!isImpersonating || isStoppingImpersonation) return;

    if (typeof update !== "function") {
      setImpersonationError("Impersonierung konnte nicht beendet werden");
      return;
    }

    setImpersonationError("");
    setIsStoppingImpersonation(true);
    try {
      const response = await fetch(API_ROUTES.AUTH.IMPERSONATION_STOP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || typeof data.proof !== "string") {
        setImpersonationError(data.error || "Impersonierung konnte nicht beendet werden");
        return;
      }

      const updatedSession = await update({ impersonationStopProof: data.proof });
      if (updatedSession?.user?.isImpersonating) {
        setImpersonationError("Impersonierung konnte nicht beendet werden");
        return;
      }

      router.push("/admin/benutzerverwaltung");
      router.refresh();
    } catch {
      setImpersonationError("Impersonierung konnte nicht beendet werden");
    } finally {
      setIsStoppingImpersonation(false);
    }
  };

  return { isImpersonating, impersonatedBy, isStoppingImpersonation, impersonationError, handleStopImpersonation };
}
