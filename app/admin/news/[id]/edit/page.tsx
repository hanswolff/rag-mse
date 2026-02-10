"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isAdmin } from "@/lib/role-utils";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { LoadingButton } from "@/components/loading-button";
import type { News, NewNews } from "@/types";

function toInputDateString(value: string) {
  return value.split("T")[0];
}

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

const initialNewNews: NewNews = {
  newsDate: getTodayDateString(),
  title: "",
  content: "",
  published: true,
};

export default function NewsEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { data: session, status } = useSession();
  const [newsItem, setNewsItem] = useState<News | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newNews, setNewNews] = useState<NewNews>(initialNewNews);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    } else if (status === "authenticated" && !isAdmin(session.user)) {
      router.push("/");
    } else if (status === "authenticated" && isAdmin(session.user)) {
      fetchNews(id);
    }
  }, [status, session, router, id]);

  async function fetchNews(id: string) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/news/${id}`);
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
      setNewNews({
        newsDate: toInputDateString(data.newsDate),
        title: data.title,
        content: data.content,
        published: data.published,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/news/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newNews),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Fehler beim Aktualisieren der News");
        return;
      }

      setSuccess("News wurde erfolgreich aktualisiert");
      setTimeout(() => {
        router.push(`/news/${id}`);
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <BackLink href={`/news/${id}`} className="text-base">
            Zurück zur News
          </BackLink>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">News bearbeiten</h1>
          <p className="text-base sm:text-base text-gray-600 mt-2">Aktualisieren Sie diese News</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {newsItem && (
          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="newsDate" className="form-label">Datum *</label>
                <input
                  id="newsDate"
                  type="date"
                  value={newNews.newsDate}
                  onChange={(e) => setNewNews({ ...newNews, newsDate: e.target.value })}
                  required
                  className="form-input"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="newsTitle" className="form-label">Titel *</label>
                <input
                  id="newsTitle"
                  type="text"
                  value={newNews.title}
                  onChange={(e) => setNewNews({ ...newNews, title: e.target.value })}
                  required
                  maxLength={200}
                  className="form-input"
                  placeholder="Titel der News"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="newsContent" className="form-label">Inhalt *</label>
                <textarea
                  id="newsContent"
                  value={newNews.content}
                  onChange={(e) => setNewNews({ ...newNews, content: e.target.value })}
                  required
                  maxLength={10000}
                  rows={10}
                  className="form-input"
                  placeholder="Inhalt der News..."
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="newsPublished"
                  type="checkbox"
                  checked={newNews.published}
                  onChange={(e) => setNewNews({ ...newNews, published: e.target.checked })}
                  className="h-4 w-4 text-brand-red-600 border-gray-300 rounded focus:ring-brand-red-600"
                  disabled={isSubmitting}
                />
                <label htmlFor="newsPublished" className="text-base text-gray-700">
                  Veröffentlichen
                </label>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <LoadingButton
                  type="submit"
                  loading={isSubmitting}
                  loadingText="Wird gespeichert..."
                  className="flex-1 btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
                >
                  Aktualisieren
                </LoadingButton>
                <Link
                  href={`/news/${id}`}
                  className="w-full sm:w-auto btn-outline py-2.5 sm:py-2 text-base sm:text-base text-center"
                >
                  Abbrechen
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
