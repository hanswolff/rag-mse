import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatDate, formatTime } from "@/lib/date-utils";

function buildDescription(location: string, description: string): string {
  const normalized = description.replace(/\s+/g, " ").trim();
  const intro = `Termin in ${location}. `;
  const maxLength = 155 - intro.length;
  if (normalized.length <= maxLength) {
    return `${intro}${normalized}`;
  }
  return `${intro}${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
      timeFrom: true,
      timeTo: true,
      location: true,
      description: true,
      visible: true,
      updatedAt: true,
    },
  });

  if (!event || !event.visible) {
    return {
      title: "Termin",
      robots: "noindex, nofollow",
    };
  }

  const title = `Termin am ${formatDate(event.date.toISOString())} (${formatTime(event.timeFrom)}-${formatTime(event.timeTo)})`;
  const description = buildDescription(event.location, event.description);

  return {
    title,
    description,
    alternates: {
      canonical: `/termine/${event.id}`,
    },
    openGraph: {
      title: `${title} | RAG Schießsport MSE`,
      description,
      type: "article",
      modifiedTime: event.updatedAt.toISOString(),
      locale: "de_DE",
    },
    twitter: {
      title,
      description,
    },
  };
}
