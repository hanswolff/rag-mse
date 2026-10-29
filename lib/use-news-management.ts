import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useAdminAuth } from "./use-admin-auth";
import { useAdminCrud } from "./use-admin-crud";
import { useAdminEntityManagement } from "./use-admin-entity-management";
import { EMPTY_NEWS_FORM } from "./news-form-defaults";
import type { News, NewNews } from "@/types";

const PUBLISH_MESSAGES = {
  news: {
    published: "News wurde veröffentlicht",
    unpublished: "News wurde als Entwurf gespeichert",
    error: "Fehler beim Veröffentlichen",
  },
} as const;

export function useNewsManagement() {
  const { status } = useAdminAuth();
  const { createFetchDataHandler, createPublishHandler } = useAdminCrud();

  const [news, setNews] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [publishingNewsId, setPublishingNewsId] = useState<string | null>(null);

  // refetch wird an den generischen Hook übergeben, bevor fetchNews existiert
  // (fetchNews braucht dessen setError) — daher spät gebunden über eine Ref.
  const fetchNewsRef = useRef<() => Promise<void> | void>(() => {});

  const management = useAdminEntityManagement<News, NewNews>({
    endpoint: "/api/admin/news",
    emptyForm: EMPTY_NEWS_FORM,
    itemToForm: (newsItem) => ({
      newsDate: newsItem.newsDate.split("T")[0],
      title: newsItem.title,
      content: newsItem.content,
      published: newsItem.published,
    }),
    messages: {
      created: "News wurde erfolgreich erstellt",
      updated: "News wurde erfolgreich aktualisiert",
      deleted: "News wurde erfolgreich gelöscht",
    },
    refetch: () => fetchNewsRef.current(),
  });

  const { setError, setSuccess } = management;

  const fetchNews = useMemo(
    () =>
      createFetchDataHandler<News[]>(
        "/api/admin/news",
        setNews,
        setError,
        setIsLoading,
        undefined,
        "news"
      ),
    [createFetchDataHandler, setError]
  );

  useEffect(() => {
    fetchNewsRef.current = fetchNews;
  }, [fetchNews]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchNews();
    }
  }, [status, fetchNews]);

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
  }, [createPublishHandler, fetchNews, setError, setSuccess]);

  return {
    news,
    isLoading,
    isCreatingNews: management.isCreating,
    isDeletingNews: management.isDeleting,
    isEditingNews: management.isUpdating,
    publishingNewsId,
    error: management.error,
    fieldErrors: management.fieldErrors,
    success: management.success,
    modalNewsData: management.modalData,
    setModalNewsData: management.setModalData,
    initialNewsData: management.initialData,
    isModalOpen: management.isModalOpen,
    editingNews: management.editingItem,
    handleCreateNews: management.handleCreate,
    handleUpdateNews: management.handleUpdate,
    handleDeleteNews: management.handleDelete,
    startEditingNews: management.startEditing,
    cancelEditingNews: management.closeModal,
    handlePublishNews,
    openCreateModal: management.openCreateModal,
    closeModal: management.closeModal,
  };
}

export type { News, NewNews };
