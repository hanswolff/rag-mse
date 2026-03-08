import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Permissions } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (!Permissions.canAccessAdminArea(session.user)) {
    redirect("/");
  }

  return <>{children}</>;
}
