import Link from "next/link";
import { getServerSession } from "next-auth";
import { formatDate } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/role-utils";
import { PaginationLinks } from "@/components/pagination-links";

const PAGE_SIZE = 10;

function parsePageParam(value: string | undefined): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

export const revalidate = 300;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const currentPage = parsePageParam(page);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const session = await getServerSession(authOptions);

  const [newsItems, total] = await Promise.all([
    prisma.news.findMany({
      where: { published: true },
      orderBy: [{ newsDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.news.count({ where: { published: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">News</h1>
          <p className="text-gray-600 mt-2 text-base sm:text-base">
            Aktuelle Neuigkeiten von der RAG Schießsport MSE
          </p>
          {session && isAdmin(session.user) && (
            <div className="mt-4">
              <Link href="/admin/news" className="btn-primary text-base font-semibold">
                News verwalten
              </Link>
            </div>
          )}
        </div>

        {newsItems.length === 0 ? (
          <div className="card text-center">
            <p className="text-gray-500 text-base sm:text-base">Keine News gefunden</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {newsItems.map((newsItem) => (
              <article
                key={newsItem.id}
                className="card-compact overflow-hidden hover:shadow-md transition-shadow"
              >
                <Link href={`/news/${newsItem.id}`} className="block">
                  <div className="p-4 sm:p-6">
                    <h2 className="text-base sm:text-xl font-semibold text-gray-900 hover:text-brand-red-600 transition-colors">
                      {newsItem.title}
                    </h2>
                    <p className="text-base sm:text-base text-gray-500 mt-1">{formatDate(newsItem.newsDate.toISOString())}</p>
                    <p className="text-gray-600 mt-3 line-clamp-3 text-base sm:text-base whitespace-pre-wrap">
                      {newsItem.content}
                    </p>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}

        <PaginationLinks basePath="/news" currentPage={currentPage} totalPages={totalPages} />
      </div>
    </main>
  );
}
