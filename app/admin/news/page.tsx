"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isAdmin } from "@/lib/role-utils";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import { useNewsManagement } from "@/lib/use-news-management";
import { formatDate } from "@/lib/date-utils";
import { NewsFormModal } from "@/components/news-form-modal";
import { LoadingButton } from "@/components/loading-button";
import { BackLink } from "@/components/back-link";
import type { News } from "@/types";

function NewsList({
  news,
  onEdit,
  onDelete,
  onPublish,
  publishingNewsId,
}: {
  news: News[];
  onEdit: (n: News) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string, published: boolean) => void;
  publishingNewsId: string | null;
}) {
  if (news.length === 0) return <p className="text-gray-500">Keine News gefunden</p>;
  return (
    <div className="space-y-3">
      {news.map((newsItem) => (
        <div key={newsItem.id} className="border border-gray-200 rounded-md p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-gray-900">{newsItem.title}</h3>
                {!newsItem.published && (
                  <span className="px-2 py-1 text-base font-medium rounded bg-yellow-100 text-yellow-800">
                    Entwurf
                  </span>
                )}
              </div>
              <p className="text-base text-gray-500 mt-1 line-clamp-2">{newsItem.content}</p>
              <p className="text-base text-gray-400 mt-2">
                Erstellt: {formatDate(newsItem.createdAt)}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:ml-4">
              <button
                onClick={() => onEdit(newsItem)}
                className="px-3 py-2 sm:py-1 text-base bg-brand-blue-50 text-brand-blue-800 rounded hover:bg-brand-blue-100 focus:outline-none focus:ring-2 focus:ring-brand-red-600/30 touch-manipulation"
              >
                Bearbeiten
              </button>
              {!newsItem.published && (
                <LoadingButton
                  onClick={() => onPublish(newsItem.id, true)}
                  loading={publishingNewsId === newsItem.id}
                  loadingText="Veröffentlichen"
                  className="px-3 py-2 sm:py-1 text-base bg-green-100 text-green-700 rounded hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 touch-manipulation disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Veröffentlichen
                </LoadingButton>
              )}
              <button
                onClick={() => onDelete(newsItem.id)}
                className="px-3 py-2 sm:py-1 text-base bg-red-100 text-red-700 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 touch-manipulation"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NewsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const newsManagement = useNewsManagement();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    } else if (status === "authenticated" && !isAdmin(session.user)) {
      router.push("/");
    }
  }, [status, session, router]);

  if (status === "loading" || newsManagement.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <BackLink href="/admin/dashboard" className="text-base">
            Zurück zum Dashboard
          </BackLink>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">News verwalten</h1>
          <p className="text-base sm:text-base text-gray-600 mt-2">Veröffentlichen und verwalten Sie Neuigkeiten und Ankündigungen</p>
        </div>

        {newsManagement.error && (
          <div
            role="alert"
            aria-live="assertive"
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          >
            {newsManagement.error}
          </div>
        )}

        {newsManagement.success && (
          <div
            role="status"
            aria-live="polite"
            className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4"
          >
            {newsManagement.success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card-compact">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">News verwalten</h2>
            <p className="text-base text-gray-600 mb-4">
              Erstellen, bearbeiten oder löschen Sie News.
            </p>
            <button
              onClick={newsManagement.openCreateModal}
              className="w-full btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
            >
              Neue News erstellen
            </button>
          </div>
          <div className="card-compact">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">News-Liste</h2>
            <NewsList
              news={newsManagement.news}
              onEdit={newsManagement.startEditingNews}
              onDelete={newsManagement.handleDeleteNews}
              onPublish={newsManagement.handlePublishNews}
              publishingNewsId={newsManagement.publishingNewsId}
            />
          </div>
        </div>

        <NewsFormModal
          isOpen={newsManagement.isModalOpen}
          onClose={newsManagement.closeModal}
          onSubmit={newsManagement.editingNews ? newsManagement.handleUpdateNews : newsManagement.handleCreateNews}
          isSubmitting={newsManagement.isCreatingNews || newsManagement.isEditingNews}
          newsData={newsManagement.modalNewsData}
          setNewsData={newsManagement.setModalNewsData}
          isEditing={!!newsManagement.editingNews}
          errors={newsManagement.error ? { general: newsManagement.error } : {}}
          initialNewsData={newsManagement.initialNewsData}
        />
      </div>
    </main>
  );
}
