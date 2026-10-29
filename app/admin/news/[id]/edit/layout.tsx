import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Permissions } from "@/lib/permissions";

export { metadata } from "./metadata";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!Permissions.canManageNews(session?.user)) {
    redirect("/admin/news");
  }

  return children;
}
