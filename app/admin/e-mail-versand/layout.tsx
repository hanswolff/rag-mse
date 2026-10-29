import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Permissions } from "@/lib/permissions";

export { metadata } from "./metadata";

// Feinrechte-Prüfung serverseitig (Defense-in-Depth zum Client-Redirect in
// usePaginatedAdminList): Auditoren haben keinen Zugriff auf den E-Mail-Versand.
export default async function Layout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!Permissions.canReadOutgoingEmails(session?.user)) {
    redirect("/");
  }

  return children;
}
