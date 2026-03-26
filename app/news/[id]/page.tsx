import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/date-utils";
import { isAdmin } from "@/lib/role-utils";
import { authOptions } from "@/lib/auth";
import { BackLink } from "@/components/back-link";

export { generateMetadata } from "./metadata";

export const revalidate = 300;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rag-mse.de";

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [session, newsItem] = await Promise.all([
    getServerSession(authOptions),
    prisma.news.findUnique({ where: { id } }),
  ]);

  if (!newsItem || !newsItem.published) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: newsItem.title,
    datePublished: newsItem.newsDate.toISOString(),
    dateModified: newsItem.updatedAt.toISOString(),
    inLanguage: "de-DE",
    author: {
      "@type": "Organization",
      name: "RAG Schießsport MSE",
    },
    publisher: {
      "@type": "Organization",
      name: "RAG Schießsport MSE",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/og-logo.png`,
      },
    },
    mainEntityOfPage: `${siteUrl}/news/${id}`,
    description: newsItem.content.slice(0, 180),
  };

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <BackLink href="/news" className="inline-flex items-center">
            Zurück zur News-Übersicht
          </BackLink>
          {session && isAdmin(session.user) && (
            <Link
              href={`/admin/news/${id}/edit`}
              className="btn-primary text-base w-full sm:w-auto"
            >
              Bearbeiten
            </Link>
          )}
        </div>

        <article className="card">
          <div className="p-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {newsItem.title}
            </h1>
            <p className="text-base text-gray-500 mb-6">
              Veröffentlicht am {formatDate(newsItem.newsDate.toISOString())}
              {newsItem.updatedAt !== newsItem.createdAt &&
                `, aktualisiert am ${formatDate(newsItem.updatedAt.toISOString())}`}
            </p>
            <div className="prose prose-slate max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {newsItem.content}
              </p>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
