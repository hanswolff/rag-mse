"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isAdmin } from "@/lib/role-utils";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import { BackLink } from "@/components/back-link";
import { Pagination } from "@/components/pagination";
import { SearchHighlight } from "@/components/search-highlight";

type OutgoingEmailStatus = "QUEUED" | "PROCESSING" | "RETRYING" | "SENT" | "FAILED";

type EmailItem = {
  id: string;
  template: string;
  toRecipients: string;
  subject: string;
  status: OutgoingEmailStatus;
  attemptCount: number;
  firstQueuedAt: string;
  nextAttemptAt: string;
  lastAttemptAt: string | null;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
};

type OutgoingEmailsResponse = {
  emails: EmailItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
};

const PAGE_SIZE = 20;

function formatDateTime(value: string): string {
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

function getStatusLabel(status: OutgoingEmailStatus): string {
  switch (status) {
    case "SENT":
      return "Versendet";
    case "FAILED":
      return "Fehlgeschlagen";
    case "QUEUED":
      return "Wartend";
    case "RETRYING":
      return "Wird erneut versucht";
    case "PROCESSING":
      return "Wird verarbeitet";
    default:
      return status;
  }
}

function getStatusClassName(status: OutgoingEmailStatus): string {
  switch (status) {
    case "SENT":
      return "text-green-700 font-semibold";
    case "FAILED":
      return "text-red-700 font-semibold";
    case "RETRYING":
      return "text-amber-700 font-semibold";
    case "PROCESSING":
      return "text-brand-blue-700 font-semibold";
    case "QUEUED":
    default:
      return "text-gray-700 font-semibold";
  }
}

export default function AdminOutgoingEmailsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [items, setItems] = useState<EmailItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [retryingEmailId, setRetryingEmailId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const showMobileCards =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 767px)").matches;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    } else if (status === "authenticated" && !isAdmin(session.user)) {
      router.push("/");
    }
  }, [status, session, router]);

  const loadEmails = useCallback(async (targetPage: number, query: string) => {
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

      const response = await fetch(`/api/admin/outgoing-emails?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "E-Mail-Versanddaten konnten nicht geladen werden");
      }

      const data = (await response.json()) as OutgoingEmailsResponse;
      setItems(data.emails);
      setPage(data.pagination.page);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.pages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "E-Mail-Versanddaten konnten nicht geladen werden");
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
    void loadEmails(page, searchQuery);
  }, [status, session, page, searchQuery, loadEmails]);

  const handleSubmitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleRetry = useCallback(async (emailId: string) => {
    setActionMessage(null);
    setError(null);
    setRetryingEmailId(emailId);

    try {
      const response = await fetch(`/api/admin/outgoing-emails/${emailId}/retry`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "E-Mail konnte nicht erneut eingeplant werden");
      }

      setActionMessage("Fehlgeschlagene E-Mail wurde erneut eingeplant.");
      await loadEmails(page, searchQuery);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "E-Mail konnte nicht erneut eingeplant werden");
    } finally {
      setRetryingEmailId(null);
    }
  }, [loadEmails, page, searchQuery]);

  const tableContent = useMemo(() => {
    if (items.length === 0) {
      return (
        <tr>
          <td className="px-4 py-6 text-base text-gray-500 text-center" colSpan={9}>
            Keine E-Mails in den letzten 30 Tagen gefunden.
          </td>
        </tr>
      );
    }

    return items.map((item) => {
      const canRetry = item.status === "FAILED";
      return (
        <tr key={item.id} className="border-t border-gray-100">
          <td className="px-4 py-3 text-base text-gray-900 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
          <td className="px-4 py-3 text-base text-gray-700">
            <SearchHighlight text={item.template} query={searchQuery} />
          </td>
          <td className="px-4 py-3 text-base text-gray-900">
            <SearchHighlight text={item.subject} query={searchQuery} />
          </td>
          <td className="px-4 py-3 text-base text-gray-700 break-all">
            <SearchHighlight text={item.toRecipients} query={searchQuery} />
          </td>
          <td className="px-4 py-3 text-base whitespace-nowrap">
            <span className={getStatusClassName(item.status)}>{getStatusLabel(item.status)}</span>
          </td>
          <td className="px-4 py-3 text-base text-gray-900 whitespace-nowrap">{item.attemptCount}</td>
          <td className="px-4 py-3 text-base text-gray-700">
            {item.lastError ? item.lastError : "-"}
          </td>
          <td className="px-4 py-3 text-base text-gray-700 whitespace-nowrap">
            {item.lastAttemptAt ? formatDateTime(item.lastAttemptAt) : "-"}
          </td>
          <td className="px-4 py-3 text-base text-gray-900 whitespace-nowrap">
            {canRetry ? (
              <button
                type="button"
                onClick={() => handleRetry(item.id)}
                className="btn-primary px-3 py-2 text-sm"
                disabled={retryingEmailId === item.id}
              >
                {retryingEmailId === item.id ? "Wird eingeplant..." : "Erneut senden"}
              </button>
            ) : (
              <span className="text-gray-500">-</span>
            )}
          </td>
        </tr>
      );
    });
  }, [handleRetry, items, retryingEmailId, searchQuery]);

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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">E-Mail-Versand</h1>
          <p className="text-base text-gray-600 mt-2">Outbox-Metadaten der letzten 30 Tage</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        {actionMessage && (
          <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded mb-4" role="status" aria-live="polite">
            {actionMessage}
          </div>
        )}

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
                placeholder="Suche nach Betreff, Empfänger oder Typ"
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
                Keine E-Mails in den letzten 30 Tagen gefunden.
              </div>
            ) : (
              items.map((item) => {
                const canRetry = item.status === "FAILED";
                return (
                  <article key={item.id} className="border border-gray-200 rounded-md bg-white p-4 space-y-2">
                    <p className="text-sm text-gray-500">{formatDateTime(item.createdAt)}</p>
                    <p className="text-base text-gray-700">
                      <span className="font-semibold text-gray-900">Typ:</span>{" "}
                      <SearchHighlight text={item.template} query={searchQuery} />
                    </p>
                    <p className="text-base text-gray-900">
                      <span className="font-semibold">Betreff:</span>{" "}
                      <SearchHighlight text={item.subject} query={searchQuery} />
                    </p>
                    <p className="text-base text-gray-700 break-all">
                      <span className="font-semibold text-gray-900">Empfänger:</span>{" "}
                      <SearchHighlight text={item.toRecipients} query={searchQuery} />
                    </p>
                    <p className="text-base">
                      <span className="font-semibold text-gray-900">Status:</span>{" "}
                      <span className={getStatusClassName(item.status)}>{getStatusLabel(item.status)}</span>
                    </p>
                    <p className="text-base text-gray-700">
                      <span className="font-semibold text-gray-900">Versuche:</span> {item.attemptCount}
                    </p>
                    <p className="text-base text-gray-700 break-words">
                      <span className="font-semibold text-gray-900">Letzter Fehler:</span> {item.lastError ? item.lastError : "-"}
                    </p>
                    <p className="text-base text-gray-700">
                      <span className="font-semibold text-gray-900">Letzter Versuch:</span>{" "}
                      {item.lastAttemptAt ? formatDateTime(item.lastAttemptAt) : "-"}
                    </p>
                    {canRetry && (
                      <button
                        type="button"
                        onClick={() => handleRetry(item.id)}
                        className="btn-primary px-3 py-2 text-sm w-full"
                        disabled={retryingEmailId === item.id}
                      >
                        {retryingEmailId === item.id ? "Wird eingeplant..." : "Erneut senden"}
                      </button>
                    )}
                  </article>
                );
              })
            )}
          </div>
          )}

          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-md bg-white">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Erstellt am</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Typ</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Betreff</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Empfänger</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Versuche</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Letzter Fehler</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Letzter Versuch</th>
                  <th scope="col" className="px-4 py-3 text-left text-base font-semibold text-gray-700">Aktion</th>
                </tr>
              </thead>
              <tbody>{tableContent}</tbody>
            </table>
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} disabled={isLoading} />
        </section>
      </div>
    </main>
  );
}
