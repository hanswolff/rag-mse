import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  robots: "noindex",
};

export default async function ShortLinkPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;

  // Obergrenze 30 deckt neben den 8-stelligen Kurzcodes auch Altbestände ab,
  // deren shortCode noch eine 25-stellige cuid ist.
  if (!shortCode || !/^[a-z0-9]{1,30}$/.test(shortCode)) {
    notFound();
  }

  const poll = await prisma.poll.findUnique({
    where: { shortCode },
    select: { id: true },
  });

  if (!poll) {
    notFound();
  }

  redirect(`/umfragen/${poll.id}`);
}
