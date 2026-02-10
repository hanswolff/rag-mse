import { useState, useCallback, useEffect } from "react";
import { useAdminAuth } from "./use-admin-auth";
import { useAdminCrud } from "./use-admin-crud";
import { useSuccessTimer } from "./use-success-timer";
import type { News, NewNews } from "@/types";

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

const PUBLISH_MESSAGES = {
  news: {
    published: "News wurde veröffentlicht",
    unpublished: "News wurde als Entwurf gespeichert",
    error: "Fehler beim Veröffentlichen",
  },
} as const;

const initialNewNews: NewNews = {
  newsDate: getTodayDateString(),
  title: "",
  content: "",
  published: true,
};

export function useNewsManagement() {
  const { status } = useAdminAuth();
  const { createFetchHandler, createDeleteHandler, createFetchDataHandler, createPublishHandler } = useAdminCrud();

  const [news, setNews] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingNews, setIsCreatingNews] = useState(false);
  const [isEditingNews, setIsEditingNews] = useState(false);
  const [publishingNewsId, setPublishingNewsId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalNewsData, setModalNewsData] = useState<NewNews>(initialNewNews);
  const [initialNewsData, setInitialNewsData] = useState<NewNews | undefined>(undefined);

  useSuccessTimer(success, setSuccess);

  const fetchNews = createFetchDataHandler<News[]>(
    "/api/admin/news",
    setNews,
    setError,
    setIsLoading,
    undefined,
    "news"
  );

  useEffect(() => {
    if (status === "authenticated") {
      fetchNews();
    }
  }, [status, fetchNews]);

  const createNews = createFetchHandler<NewNews>(
    "/api/admin/news",
    "POST",
    setError,
    setIsCreatingNews,
    modalNewsData
  );

  const updateNews = createFetchHandler<NewNews>(
    "/api/admin/news",
    "PUT",
    setError,
    setIsEditingNews,
    modalNewsData
  );

  const deleteNews = createFetchHandler(
    "/api/admin/news",
    "DELETE",
    setError,
    setIsCreatingNews
  );

  const handleCreateNews = useCallback(async (e: React.FormEvent) => {
    if (e) e.preventDefault();

    const result = await createNews();
    if (result.success) {
      setSuccess("News wurde erfolgreich erstellt");
      setIsModalOpen(false);
      setModalNewsData(initialNewNews);
      setEditingNews(null);
      await fetchNews();
    }
  }, [createNews, fetchNews]);

  const handleUpdateNews = useCallback(async (e: React.FormEvent) => {
    if (!editingNews) return;
    if (e) e.preventDefault();

    const result = await updateNews(editingNews.id);
    if (result.success) {
      setSuccess("News wurde erfolgreich aktualisiert");
      setIsModalOpen(false);
      setModalNewsData(initialNewNews);
      setEditingNews(null);
      await fetchNews();
    }
  }, [editingNews, updateNews, fetchNews]);

  const handleDeleteNews = createDeleteHandler(
    deleteNews,
    setSuccess,
    "News wurde erfolgreich gelöscht",
    fetchNews
  );

  const startEditingNews = useCallback((newsItem: News) => {
    setEditingNews(newsItem);
    const newsData = {
      newsDate: newsItem.newsDate.split("T")[0],
      title: newsItem.title,
      content: newsItem.content,
      published: newsItem.published,
    };
    setModalNewsData(newsData);
    setInitialNewsData(newsData);
    setError("");
    setIsModalOpen(true);
  }, []);

  const openCreateModal = useCallback(() => {
    setModalNewsData(initialNewNews);
    setEditingNews(null);
    setInitialNewsData(undefined);
    setError("");
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalNewsData(initialNewNews);
    setInitialNewsData(undefined);
    setEditingNews(null);
    setError("");
  }, []);

  const cancelEditingNews = useCallback(() => {
    closeModal();
  }, [closeModal]);

  const handlePublishNews = useCallback(async (newsId: string, published: boolean) => {
    const publish = createPublishHandler(setSuccess, setError, fetchNews);
    setPublishingNewsId(newsId);
    try {
      await publish(
        `/api/admin/news/${newsId}`,
        { published },
        {
          success: published ? PUBLISH_MESSAGES.news.published : PUBLISH_MESSAGES.news.unpublished,
          error: PUBLISH_MESSAGES.news.error,
        }
      );
    } finally {
      setPublishingNewsId(null);
    }
  }, [createPublishHandler, fetchNews]);

  return {
    news,
    isLoading,
    isCreatingNews,
    isEditingNews,
    publishingNewsId,
    error,
    success,
    modalNewsData,
    setModalNewsData,
    initialNewsData,
    isModalOpen,
    editingNews,
    handleCreateNews,
    handleUpdateNews,
    handleDeleteNews,
    startEditingNews,
    cancelEditingNews,
    handlePublishNews,
    openCreateModal,
    closeModal,
  };
}

export type { News, NewNews };
