import type { MetadataRoute } from "next";
import { access } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rag-mse.de";

const staticPaths = [
  "",
  "/termine",
  "/termine/vergangenheit",
  "/news",
  "/ueber-uns",
  "/kontakt",
  "/info",
  "/info/schiesssportordnung",
  "/info/leitfaden-waffenteile",
  "/info/waffentechnische-begriffe",
  "/info/sachkundepruefung",
  "/info/sicherheitsbelehrung",
  "/info/formulare",
  "/impressum",
  "/datenschutz",
] as const;

async function canQueryDynamicEntries(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return false;
  }

  if (!databaseUrl.startsWith("file:")) {
    return true;
  }

  const sqlitePathRaw = decodeURIComponent(databaseUrl.replace("file:", ""));
  const sqlitePath = path.isAbsolute(sqlitePathRaw)
    ? sqlitePathRaw
    : path.resolve(process.cwd(), sqlitePathRaw);
  const sqliteDirectory = path.dirname(sqlitePath);

  try {
    await access(sqliteDirectory);
    return true;
  } catch {
    return false;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let events: Array<{ id: string; updatedAt: Date }> = [];
  let news: Array<{ id: string; updatedAt: Date }> = [];

  if (await canQueryDynamicEntries()) {
    try {
      [events, news] = await Promise.all([
        prisma.event.findMany({
          where: { visible: true },
          select: { id: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        }),
        prisma.news.findMany({
          where: { published: true },
          select: { id: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        }),
      ]);
    } catch {
      // Keep static sitemap entries when DB is unavailable during build/runtime.
    }
  }

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.8,
  }));

  const eventEntries: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${siteUrl}/termine/${event.id}`,
    lastModified: event.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const newsEntries: MetadataRoute.Sitemap = news.map((item) => ({
    url: `${siteUrl}/news/${item.id}`,
    lastModified: item.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...eventEntries, ...newsEntries];
}
