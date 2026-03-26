"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BackLink } from "@/components/back-link";
import { Modal } from "@/components/modal";
import { Pagination } from "@/components/pagination";
import { SearchHighlight } from "@/components/search-highlight";
import { SortableTableHeader } from "@/components/sortable-table-header";
import { EyeIcon } from "@/components/icons";
import { LoadingScreen } from "@/components/loading-screen";
import { formatDate, formatTime } from "@/lib/date-utils";
import { useTableSorting } from "@/lib/use-table-sorting";
import { Permissions } from "@/lib/permissions";
import { AlertBox } from "@/components/alert-box";

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

type NotificationsResponse = {
  notifications: NotificationItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
};

const PAGE_SIZE = 20;
type NotificationSortField = "sentAt" | "status" | "userName" | "userEmail" | "eventDate" | "eventTime" | "location" | "pollTitle";
const NOTIFICATION_DEFAULT_SORT_DIRECTIONS: Partial<Record<NotificationSortField, "asc" | "desc">> = {
  sentAt: "desc",
};

function formatSentAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingNotification, setViewingNotification] = useState<NotificationItem | null>(null);
  const [notificationType, setNotificationType] = useState<"event" | "poll">("event");
  const { sortBy, sortDir, handleSortChange } = useTableSorting<NotificationSortField>(
    "sentAt",
    "desc",
    NOTIFICATION_DEFAULT_SORT_DIRECTIONS,
  );
  const showMobileCards =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 767px)").matches;

  useEffect(() => {
    if (status === "authenticated" && !Permissions.canReadNotificationsAdmin(session?.user)) {
      router.push("/");
    }
  }, [status, session, router]);

  const loadNotifications = useCallback(async (
    targetPage: number,
    query: string,
    nextSortBy: NotificationSortField,
    nextSortDir: "asc" | "desc",
    type: "event" | "poll",
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        sortBy: nextSortBy,
        sortDir: nextSortDir,
        type,
      });

      if (query.trim().length > 0) {
        params.set("q", query.trim());
      }

      const response = await fetch(`/api/admin/notifications?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Benachrichtigungen konnten nicht geladen werden");
      }

      const data = (await response.json()) as NotificationsResponse;

      setItems(data.notifications);
      setPage(data.pagination.page);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.pages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Benachrichtigungen konnten nicht geladen werden");
      setItems([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !session || !Permissions.canReadNotificationsAdmin(session.user)) {
      return;
    }
    void loadNotifications(page, searchQuery, sortBy, sortDir, notificationType);
  }, [status, session, page, searchQuery, sortBy, sortDir, notificationType, loadNotifications]);

  const handleSubmitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleTableSort = useCallback((field: NotificationSortField) => {
    setPage(1);
    handleSortChange(field);
  }, [handleSortChange]);

  const handleTypeChange = useCallback((type: "event" | "poll") => {
    setPage(1);
    setSearchInput("");
    setSearchQuery("");
    setNotificationType(type);
  }, []);

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
          {item.sentAt ? formatSentAt(item.sentAt) : formatSentAt(item.queuedAt)}
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

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <BackLink href="/admin/dashboard" className="text-base">
            Zurück zum Dashboard
          </BackLink>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">Benachrichtigungen</h1>
          <p className="text-base text-gray-600 mt-2">Versendete Benachrichtigungen der letzten 30 Tage</p>
        </div>

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

        <AlertBox type="error" message={error} className="mb-4" />

        <section className="card-compact">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Versandverlauf</h2>
              <p className="text-base text-gray-600 mt-1">{total} Einträge</p>
            </div>
            <form onSubmit={handleSubmitSearch} className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Suche nach Name oder E-Mail"
                className="form-input w-full md:w-80"
              />
              <button type="submit" className="btn-primary px-4 py-2 text-base whitespace-nowrap w-full sm:w-auto">
                Suchen
              </button>
            </form>
          </div>

          {showMobileCards && (
          <div className="space-y-3 md:hidden">
            {items.length === 0 ? (
              <div className="border border-gray-200 rounded-md bg-white px-4 py-6 text-base text-gray-500 text-center">
                Keine Benachrichtigungen in den letzten 30 Tagen gefunden.
              </div>
            ) : (
              items.map((item) => (
                <article key={item.id} className="border border-gray-200 rounded-md bg-white p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-gray-500">{item.sentAt ? formatSentAt(item.sentAt) : formatSentAt(item.queuedAt)}</p>
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
            )}
          </div>
          )}

          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-md bg-white">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3 text-left text-base font-semibold text-gray-700 w-10">
                    <span className="sr-only">Aktionen</span>
                  </th>
                  <SortableTableHeader
                    label="Versendet am"
                    field="sentAt"
                    activeField={sortBy}
                    sortDir={sortDir}
                    onSortChange={handleTableSort}
                    className="px-4 py-3 text-left text-base font-semibold text-gray-700"
                  />
                  <SortableTableHeader
                    label="Status"
                    field="status"
                    activeField={sortBy}
                    sortDir={sortDir}
                    onSortChange={handleTableSort}
                    className="px-4 py-3 text-left text-base font-semibold text-gray-700"
                  />
                  <SortableTableHeader
                    label="Name"
                    field="userName"
                    activeField={sortBy}
                    sortDir={sortDir}
                    onSortChange={handleTableSort}
                    className="px-4 py-3 text-left text-base font-semibold text-gray-700"
                  />
                  <SortableTableHeader
                    label="E-Mail"
                    field="userEmail"
                    activeField={sortBy}
                    sortDir={sortDir}
                    onSortChange={handleTableSort}
                    className="px-4 py-3 text-left text-base font-semibold text-gray-700"
                  />
                  {notificationType === "event" ? (
                    <>
                      <SortableTableHeader
                        label="Termin-Datum"
                        field="eventDate"
                        activeField={sortBy}
                        sortDir={sortDir}
                        onSortChange={handleTableSort}
                        className="px-4 py-3 text-left text-base font-semibold text-gray-700"
                      />
                      <SortableTableHeader
                        label="Uhrzeit"
                        field="eventTime"
                        activeField={sortBy}
                        sortDir={sortDir}
                        onSortChange={handleTableSort}
                        className="px-4 py-3 text-left text-base font-semibold text-gray-700"
                      />
                      <SortableTableHeader
                        label="Ort"
                        field="location"
                        activeField={sortBy}
                        sortDir={sortDir}
                        onSortChange={handleTableSort}
                        className="px-4 py-3 text-left text-base font-semibold text-gray-700"
                      />
                    </>
                  ) : (
                    <SortableTableHeader
                      label="Umfrage"
                      field="pollTitle"
                      activeField={sortBy}
                      sortDir={sortDir}
                      onSortChange={handleTableSort}
                      className="px-4 py-3 text-left text-base font-semibold text-gray-700"
                    />
                  )}
                </tr>
              </thead>
              <tbody>{tableContent}</tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            disabled={isLoading}
          />
        </section>

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
                      ? formatSentAt(viewingNotification.sentAt)
                      : formatSentAt(viewingNotification.queuedAt)}
                  </p>
                </div>
              </div>

              {viewingNotification.type === "event" ? (
                <>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Betreff</p>
                    <p className="text-base font-medium text-gray-900">
                      Erinnerung: Bitte Teilnahme für Termin bestätigen
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-2">Nachricht</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-base text-gray-800 whitespace-pre-wrap">
                      {`Hallo,

in ${viewingNotification.daysBefore} Tag(en) findet ein Termin statt, für den noch keine Teilnahme von dir hinterlegt ist.

Datum: ${formatDate(viewingNotification.event.date)}
Uhrzeit: ${formatTime(viewingNotification.event.timeFrom)} - ${formatTime(viewingNotification.event.timeTo)}
Ort: ${viewingNotification.event.location}

Direkt zur Anmeldung (Ja/Nein/Vielleicht):
[Link enthält persönlichen Anmelde-Token]

Wenn du diese Erinnerung für zukünftige Termine nicht mehr erhalten möchtest, kannst du sie mit einem Klick deaktivieren:
[Link enthält persönlichen Abmelde-Token]

Viele Grüße
RAG Schießsport MSE`}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Betreff</p>
                    <p className="text-base font-medium text-gray-900">
                      Neue Umfrage: {viewingNotification.poll.title}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-2">Nachricht</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-base text-gray-800 whitespace-pre-wrap">
                      {`Hallo ${viewingNotification.user.name || viewingNotification.user.email},

es wurde eine neue Umfrage veröffentlicht: "${viewingNotification.poll.title}"

${viewingNotification.poll.description || ""}

Hier kannst du abstimmen:
[Link enthält persönlichen Token]

Viele Grüße,
RAG Schießsport MSE`}
                    </div>
                  </div>
                </>
              )}

              <div className="pt-2 text-sm text-gray-500">
                <p>Die Links in der E-Mail enthalten persönliche Tokens für den Empfänger.</p>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </main>
  );
}
