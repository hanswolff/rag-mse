"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isAdmin } from "@/lib/role-utils";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import { BackLink } from "@/components/back-link";
import { Pagination } from "@/components/pagination";
import { formatDate, formatTime } from "@/lib/date-utils";

type NotificationItem = {
  id: string;
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    } else if (status === "authenticated" && !isAdmin(session.user)) {
      router.push("/");
    }
  }, [status, session, router]);

  const loadNotifications = useCallback(async (targetPage: number, query: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
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
    if (status !== "authenticated" || !session || !isAdmin(session.user)) {
      return;
    }
    void loadNotifications(page, searchQuery);
  }, [status, session, page, searchQuery, loadNotifications]);

  const handleSubmitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const tableContent = useMemo(() => {
    if (items.length === 0) {
      return (
        <tr>
          <td className="px-4 py-6 text-base text-gray-500 text-center" colSpan={7}>
            Keine Benachrichtigungen in den letzten 30 Tagen gefunden.
          </td>
        </tr>
      );
    }

    return items.map((item) => (
      <tr key={item.id} className="border-t border-gray-100">
        <td className="px-4 py-3 text-base text-gray-900 whitespace-nowrap">
          {item.sentAt ? formatSentAt(item.sentAt) : formatSentAt(item.queuedAt)}
        </td>
        <td className="px-4 py-3 text-base whitespace-nowrap">
          <span className={item.status === "VERSENDET" ? "text-green-700 font-semibold" : "text-amber-700 font-semibold"}>
            {item.status === "VERSENDET" ? "Versendet" : "Ausstehend"}
          </span>
        </td>
        <td className="px-4 py-3 text-base text-gray-900">
          {item.user.name || "-"}
        </td>
        <td className="px-4 py-3 text-base text-gray-700 break-all">
          {item.user.email}
        </td>
        <td className="px-4 py-3 text-base text-gray-900 whitespace-nowrap">
          {formatDate(item.event.date)}
        </td>
        <td className="px-4 py-3 text-base text-gray-700 whitespace-nowrap">
          {formatTime(item.event.timeFrom)} - {formatTime(item.event.timeTo)}
        </td>
        <td className="px-4 py-3 text-base text-gray-900">
          {item.event.location}
        </td>
      </tr>
    ));
  }, [items]);

  if (status === "loading" || isLoading) {
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">Benachrichtigungen</h1>
          <p className="text-base text-gray-600 mt-2">Versendete Termin-Benachrichtigungen der letzten 30 Tage</p>
        </div>

        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        <section className="card-compact">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Versandverlauf</h2>
              <p className="text-base text-gray-600 mt-1">{total} Einträge</p>
            </div>
            <form onSubmit={handleSubmitSearch} className="flex w-full md:w-auto gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Suche nach Name oder E-Mail"
                className="form-input w-full md:w-80"
              />
              <button type="submit" className="btn-primary px-4 py-2 text-base whitespace-nowrap">
                Suchen
              </button>
            </form>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-md bg-white">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Versendet am</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Name</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">E-Mail</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Termin-Datum</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Uhrzeit</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Ort</th>
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
      </div>
    </main>
  );
}
