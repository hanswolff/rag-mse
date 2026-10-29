"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { SearchHighlight } from "@/components/search-highlight";
import { EyeIcon } from "@/components/icons";
import { LoadingScreen } from "@/components/loading-screen";
import { formatDate, formatTime } from "@/lib/date-utils";
import { formatDateTime } from "@/lib/dates";
import { Permissions, UserWithRole } from "@/lib/permissions";
import { AlertBox } from "@/components/alert-box";
import { usePaginatedAdminList } from "@/lib/use-paginated-admin-list";
import { AdminListColumn, AdminListShell } from "@/components/admin-list-shell";

type EventNotificationItem = {
  id: string;
  type: "event";
  sentAt: string | null;
  queuedAt: string;
  status: "VERSENDET" | "AUSSTEHEND";
  daysBefore: number;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  event: {
    id: string;
    date: string;
    timeFrom: string;
    timeTo: string;
    location: string;
  };
};

type PollNotificationItem = {
  id: string;
  type: "poll";
  sentAt: string | null;
  queuedAt: string;
  status: "VERSENDET" | "AUSSTEHEND";
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  poll: {
    id: string;
    title: string;
    description: string | null;
  };
};

type NotificationItem = EventNotificationItem | PollNotificationItem;

type NotificationPreview = {
  subject: string;
  body: string;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
};

type NotificationSortField = "sentAt" | "status" | "userName" | "userEmail" | "eventDate" | "eventTime" | "location" | "pollTitle";
const NOTIFICATION_DEFAULT_SORT_DIRECTIONS: Partial<Record<NotificationSortField, "asc" | "desc">> = {
  sentAt: "desc",
};

const NOTIFICATION_BASE_COLUMNS: AdminListColumn<NotificationSortField>[] = [
  { label: "Aktionen", srOnly: true },
  { label: "Versendet am", field: "sentAt" },
  { label: "Status", field: "status" },
  { label: "Name", field: "userName" },
  { label: "E-Mail", field: "userEmail" },
];

const EVENT_NOTIFICATION_COLUMNS: AdminListColumn<NotificationSortField>[] = [
  ...NOTIFICATION_BASE_COLUMNS,
  { label: "Termin-Datum", field: "eventDate" },
  { label: "Uhrzeit", field: "eventTime" },
  { label: "Ort", field: "location" },
];

const POLL_NOTIFICATION_COLUMNS: AdminListColumn<NotificationSortField>[] = [
  ...NOTIFICATION_BASE_COLUMNS,
  { label: "Umfrage", field: "pollTitle" },
];

const extractNotifications = (data: NotificationsResponse) => data.notifications;
const canAccessNotificationsAdmin = (user: UserWithRole) => Permissions.canReadNotificationsAdmin(user);

export default function AdminNotificationsPage() {
  const [viewingNotification, setViewingNotification] = useState<NotificationItem | null>(null);
  const [preview, setPreview] = useState<NotificationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [notificationType, setNotificationType] = useState<"event" | "poll">("event");

  const {
    status,
    items,
    page,
    setPage,
    total,
    totalPages,
    isLoading,
    error,
    searchInput,
    setSearchInput,
    searchQuery,
    setSearchQuery,
    sortBy,
    sortDir,
    handleSubmitSearch,
    handleTableSort,
  } = usePaginatedAdminList<NotificationItem, NotificationSortField, NotificationsResponse>({
    endpoint: "/api/admin/notifications",
    extractItems: extractNotifications,
    loadErrorMessage: "Benachrichtigungen konnten nicht geladen werden",
    canAccess: canAccessNotificationsAdmin,
    initialSortField: "sentAt",
    initialSortDirection: "desc",
    defaultSortDirections: NOTIFICATION_DEFAULT_SORT_DIRECTIONS,
    extraParams: { type: notificationType },
  });

  useEffect(() => {
    if (!viewingNotification) {
      return;
    }

    let cancelled = false;
    setPreview(null);
    setPreviewError(null);

    const params = new URLSearchParams({
      type: viewingNotification.type,
      id: viewingNotification.id,
    });

    fetch(`/api/admin/notifications/preview?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(typeof data.error === "string" ? data.error : "Vorschau konnte nicht geladen werden");
        }
        return (await response.json()) as NotificationPreview;
      })
      .then((data) => {
        if (!cancelled) {
          setPreview(data);
        }
      })
      .catch((previewLoadError) => {
        if (!cancelled) {
          setPreviewError(previewLoadError instanceof Error ? previewLoadError.message : "Vorschau konnte nicht geladen werden");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [viewingNotification]);

  const handleTypeChange = useCallback((type: "event" | "poll") => {
    setPage(1);
    setSearchInput("");
    setSearchQuery("");
    setNotificationType(type);
  }, [setPage, setSearchInput, setSearchQuery]);

  const tableContent = useMemo(() => {
    if (items.length === 0) {
      return (
        <tr>
          <td className="px-4 py-6 text-base text-gray-500 text-center" colSpan={notificationType === "event" ? 8 : 6}>
            Keine Benachrichtigungen in den letzten 30 Tagen gefunden.
          </td>
        </tr>
      );
    }

    return items.map((item) => (
      <tr key={item.id} className="border-t border-gray-100">
        <td className="px-2 py-3">
          <button
            type="button"
            onClick={() => setViewingNotification(item)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Inhalt anzeigen"
            aria-label="Benachrichtigungsinhalt anzeigen"
          >
            <EyeIcon className="h-5 w-5" />
          </button>
        </td>
        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
          {item.sentAt ? formatDateTime(item.sentAt) : formatDateTime(item.queuedAt)}
        </td>
        <td className="px-4 py-3 text-sm whitespace-nowrap">
          <span className={item.status === "VERSENDET" ? "text-green-700 font-semibold" : "text-amber-700 font-semibold"}>
            {item.status === "VERSENDET" ? "Versendet" : "Ausstehend"}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-900">
          {item.user.name
            ? <SearchHighlight text={item.user.name} query={searchQuery} />
            : "-"}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 break-all">
          <SearchHighlight text={item.user.email} query={searchQuery} />
        </td>
        {item.type === "event" ? (
          <>
            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
              {formatDate(item.event.date)}
            </td>
            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
              {formatTime(item.event.timeFrom)} - {formatTime(item.event.timeTo)}
            </td>
            <td className="px-4 py-3 text-sm text-gray-900">
              {item.event.location}
            </td>
          </>
        ) : (
          <td className="px-4 py-3 text-sm text-gray-900">
            {item.poll.title}
          </td>
        )}
      </tr>
    ));
  }, [items, searchQuery, notificationType]);

  if (status === "loading" || isLoading) {
    return <LoadingScreen />;
  }

  const typeTabs = (
    <div className="flex gap-1 mb-6 border-b border-gray-200">
      <button
        type="button"
        onClick={() => handleTypeChange("event")}
        className={`px-4 py-2 text-sm font-medium transition-colors ${
          notificationType === "event"
            ? "border-b-2 border-brand-red-600 text-brand-red-600"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Termin-Erinnerungen
      </button>
      <button
        type="button"
        onClick={() => handleTypeChange("poll")}
        className={`px-4 py-2 text-sm font-medium transition-colors ${
          notificationType === "poll"
            ? "border-b-2 border-brand-red-600 text-brand-red-600"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Umfrage-Benachrichtigungen
      </button>
    </div>
  );

  const mobileList = items.length === 0 ? (
    <div className="border border-gray-200 rounded-md bg-white px-4 py-6 text-base text-gray-500 text-center">
      Keine Benachrichtigungen in den letzten 30 Tagen gefunden.
    </div>
  ) : (
    items.map((item) => (
      <article key={item.id} className="border border-gray-200 rounded-md bg-white p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-gray-500">{item.sentAt ? formatDateTime(item.sentAt) : formatDateTime(item.queuedAt)}</p>
            <p className={item.status === "VERSENDET" ? "text-green-700 font-semibold" : "text-amber-700 font-semibold"}>
              {item.status === "VERSENDET" ? "Versendet" : "Ausstehend"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setViewingNotification(item)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Inhalt anzeigen"
            aria-label="Benachrichtigungsinhalt anzeigen"
          >
            <EyeIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="text-base text-gray-900">
          <span className="font-semibold">Name:</span>{" "}
          {item.user.name ? <SearchHighlight text={item.user.name} query={searchQuery} /> : "-"}
        </p>
        <p className="text-base text-gray-700 break-all">
          <span className="font-semibold text-gray-900">E-Mail:</span>{" "}
          <SearchHighlight text={item.user.email} query={searchQuery} />
        </p>
        {item.type === "event" ? (
          <>
            <p className="text-base text-gray-900">
              <span className="font-semibold">Termin:</span> {formatDate(item.event.date)}
            </p>
            <p className="text-base text-gray-700">
              <span className="font-semibold text-gray-900">Uhrzeit:</span>{" "}
              {formatTime(item.event.timeFrom)} - {formatTime(item.event.timeTo)}
            </p>
            <p className="text-base text-gray-900 break-words">
              <span className="font-semibold">Ort:</span> {item.event.location}
            </p>
          </>
        ) : (
          <p className="text-base text-gray-900 break-words">
            <span className="font-semibold">Umfrage:</span> {item.poll.title}
          </p>
        )}
      </article>
    ))
  );

  return (
    <AdminListShell
      title="Benachrichtigungen"
      subtitle="Versendete Benachrichtigungen der letzten 30 Tage"
      listTitle="Versandverlauf"
      error={error}
      aboveList={typeTabs}
      total={total}
      searchPlaceholder="Suche nach Name oder E-Mail"
      searchInput={searchInput}
      onSearchInputChange={setSearchInput}
      onSubmitSearch={handleSubmitSearch}
      columns={notificationType === "event" ? EVENT_NOTIFICATION_COLUMNS : POLL_NOTIFICATION_COLUMNS}
      sortBy={sortBy}
      sortDir={sortDir}
      onSortChange={handleTableSort}
      mobileList={mobileList}
      tableBody={tableContent}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
      isLoading={isLoading}
    >
      <Modal
        isOpen={viewingNotification !== null}
        onClose={() => setViewingNotification(null)}
        title="Benachrichtigungsinhalt"
        size="3xl"
      >
        {viewingNotification && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500">Empfänger</p>
                <p className="text-base font-medium text-gray-900">
                  {viewingNotification.user.name || viewingNotification.user.email}
                </p>
                <p className="text-sm text-gray-600">{viewingNotification.user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className={`text-base font-semibold ${viewingNotification.status === "VERSENDET" ? "text-green-700" : "text-amber-700"}`}>
                  {viewingNotification.status === "VERSENDET" ? "Versendet" : "Ausstehend"}
                </p>
                <p className="text-sm text-gray-600">
                  {viewingNotification.sentAt
                    ? formatDateTime(viewingNotification.sentAt)
                    : formatDateTime(viewingNotification.queuedAt)}
                </p>
              </div>
            </div>

            {previewError ? (
              <AlertBox type="error" message={previewError} />
            ) : preview ? (
              <>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Betreff</p>
                  <p className="text-base font-medium text-gray-900">{preview.subject}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-2">Nachricht</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-base text-gray-800 whitespace-pre-wrap">
                    {preview.body}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-base text-gray-500">Vorschau wird geladen …</p>
            )}

            {viewingNotification.type === "event" && (
              <div className="pt-2 text-sm text-gray-500">
                <p>Die Links in der E-Mail enthalten persönliche Tokens für den Empfänger und werden in der Vorschau durch Platzhalter ersetzt.</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AdminListShell>
  );
}
