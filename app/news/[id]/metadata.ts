import type { Metadata } from "next";
import { appName } from "@/lib/site-config";
import { prisma } from "@/lib/prisma";

function buildDescription(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 155) {
    return normalized;
  }
  return `${normalized.slice(0, 152)}...`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const newsItem = await prisma.news.findUnique({
    where: { id },
    select: {
      title: true,
      content: true,
      published: true,
      updatedAt: true,
    },
  });

  if (!newsItem || !newsItem.published) {
    return {
      title: "News",
      robots: "noindex, nofollow",
    };
  }

  const description = buildDescription(newsItem.content);

  return {
    title: newsItem.title,
    description,
    alternates: {
      canonical: `/news/${id}`,
    },
    openGraph: {
      title: `${newsItem.title} | ${appName}`,
      description,
      type: "article",
      modifiedTime: newsItem.updatedAt.toISOString(),
      locale: "de_DE",
    },
    twitter: {
      title: newsItem.title,
      description,
    },
  };
}
