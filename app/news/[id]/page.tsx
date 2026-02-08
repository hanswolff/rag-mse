"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatDate } from "@/lib/date-utils";
import { isAdmin } from "@/lib/role-utils";
import { BackLink } from "@/components/back-link";
import type { News } from "@/types";

export default function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [newsItem, setNewsItem] = useState<News | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchNews(id);
  }, [id]);

  async function fetchNews(id: string) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/news/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("News nicht gefunden");
        } else {
          throw new Error("Fehler beim Laden der News");
        }
        return;
      }

      const data: News = await response.json();
      setNewsItem(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <BackLink href="/news" className="inline-flex items-center">
            Zurück zur News-Übersicht
          </BackLink>
          {session && isAdmin(session.user) && newsItem && (
            <Link
              href={`/admin/news/${id}/edit`}
              className="btn-primary ml-4 text-base"
            >
              Bearbeiten
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="text-gray-600 text-center py-8">Laden...</div>
        ) : error ? (
          <div className="card text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <BackLink href="/news">
              Zurück zur News-Übersicht
            </BackLink>
          </div>
        ) : newsItem ? (
          <article className="card">
            <div className="p-0">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {newsItem.title}
              </h1>
              <p className="text-base text-gray-500 mb-6">
                Veröffentlicht am {formatDate(newsItem.createdAt)}
                {newsItem.updatedAt !== newsItem.createdAt &&
                  `, aktualisiert am ${formatDate(newsItem.updatedAt)}`}
              </p>
              <div className="prose prose-slate max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {newsItem.content}
                </p>
              </div>
            </div>
          </article>
        ) : null}
      </div>
    </main>
  );
}
