"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatDate } from "@/lib/date-utils";
import { Pagination } from "@/components/pagination";
import { isAdmin } from "@/lib/role-utils";
import type { News } from "@/types";

interface NewsListResponse {
  news: News[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export default function NewsPage() {
  const { data: session } = useSession();
  const [newsData, setNewsData] = useState<News[]>([]);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>({ total: 0, page: 1, limit: 10, pages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchNews(currentPage);
  }, [currentPage]);

  async function fetchNews(page: number) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/news?page=${page}&limit=10`);

      if (!response.ok) {
        throw new Error("Fehler beim Laden der News");
      }

      const data: NewsListResponse = await response.json();
      setNewsData(data.news);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }

  function handlePageChange(newPage: number) {
    setCurrentPage(newPage);
  }

  return (
    <main className="min-h-screen bg-gray-50">
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

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-3 rounded mb-4 text-base">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-gray-600 text-center py-8">Laden...</div>
        ) : newsData.length === 0 ? (
          <div className="card text-center">
            <p className="text-gray-500 text-base sm:text-base">Keine News gefunden</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {newsData.map((newsItem) => (
              <article
                key={newsItem.id}
                className="card-compact overflow-hidden hover:shadow-md transition-shadow"
              >
                <Link href={`/news/${newsItem.id}`} className="block">
                  <div className="p-4 sm:p-6">
                    <h2 className="text-base sm:text-xl font-semibold text-gray-900 hover:text-brand-red-600 transition-colors">
                      {newsItem.title}
                    </h2>
                    <p className="text-base sm:text-base text-gray-500 mt-1">{formatDate(newsItem.newsDate)}</p>
                    <p className="text-gray-600 mt-3 line-clamp-3 text-base sm:text-base">{newsItem.content}</p>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={pagination.pages}
          onPageChange={handlePageChange}
          disabled={isLoading || newsData.length === 0}
        />
      </div>
    </main>
  );
}
