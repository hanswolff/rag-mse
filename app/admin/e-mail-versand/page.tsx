"use client";

import { useCallback, useMemo, useState } from "react";
import { canManageAdminArea } from "@/lib/role-utils";
import { Modal } from "@/components/modal";
import { SearchHighlight } from "@/components/search-highlight";
import { EyeIcon } from "@/components/icons";
import { LoadingScreen } from "@/components/loading-screen";
import { Permissions, UserWithRole } from "@/lib/permissions";
import { formatDateTime } from "@/lib/dates";
import { usePaginatedAdminList } from "@/lib/use-paginated-admin-list";
import { AdminListColumn, AdminListShell } from "@/components/admin-list-shell";

type OutgoingEmailStatus = "QUEUED" | "PROCESSING" | "RETRYING" | "SENT" | "FAILED";

type EmailItem = {
  id: string;
  template: string;
  toRecipients: string;
  subject: string;
  textBody: string;
  htmlBody: string;
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

type OutgoingEmailSortField =
  "createdAt"
  | "template"
  | "subject"
  | "toRecipients"
  | "status"
  | "attemptCount"
  | "lastError"
  | "lastAttemptAt";
const OUTGOING_EMAIL_DEFAULT_SORT_DIRECTIONS: Partial<Record<OutgoingEmailSortField, "asc" | "desc">> = {
  createdAt: "desc",
  lastAttemptAt: "desc",
  attemptCount: "desc",
};

const OUTGOING_EMAIL_COLUMNS: AdminListColumn<OutgoingEmailSortField>[] = [
  { label: "Anzeigen", srOnly: true },
  { label: "Erstellt am", field: "createdAt" },
  { label: "Typ", field: "template" },
  { label: "Betreff", field: "subject" },
  { label: "Empfänger", field: "toRecipients" },
  { label: "Status", field: "status" },
  { label: "Versuche", field: "attemptCount" },
  { label: "Letzter Fehler", field: "lastError" },
  { label: "Letzter Versuch", field: "lastAttemptAt" },
  { label: "Aktion" },
];

const extractEmails = (data: OutgoingEmailsResponse) => data.emails;
const canAccessOutgoingEmails = (user: UserWithRole) => Permissions.canReadOutgoingEmails(user);

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
  const [retryingEmailId, setRetryingEmailId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [viewingEmail, setViewingEmail] = useState<EmailItem | null>(null);
  const [emailContentTab, setEmailContentTab] = useState<"text" | "html">("text");

  const {
    session,
    status,
    items,
    page,
    setPage,
    total,
    totalPages,
    isLoading,
    error,
    setError,
    searchInput,
    setSearchInput,
    searchQuery,
    sortBy,
    sortDir,
    handleSubmitSearch,
    handleTableSort,
    reload,
  } = usePaginatedAdminList<EmailItem, OutgoingEmailSortField, OutgoingEmailsResponse>({
    endpoint: "/api/admin/outgoing-emails",
    extractItems: extractEmails,
    loadErrorMessage: "E-Mail-Versanddaten konnten nicht geladen werden",
    canAccess: canAccessOutgoingEmails,
    initialSortField: "createdAt",
    initialSortDirection: "desc",
    defaultSortDirections: OUTGOING_EMAIL_DEFAULT_SORT_DIRECTIONS,
  });

  const canManage = session ? canManageAdminArea(session.user) : false;

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
      await reload();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "E-Mail konnte nicht erneut eingeplant werden");
    } finally {
      setRetryingEmailId(null);
    }
  }, [reload, setError]);

  const tableContent = useMemo(() => {
    if (items.length === 0) {
      return (
        <tr>
          <td className="px-4 py-6 text-base text-gray-500 text-center" colSpan={10}>
            Keine E-Mails in den letzten 30 Tagen gefunden.
          </td>
        </tr>
      );
    }

    return items.map((item) => {
      const canRetry = item.status === "FAILED";
      return (
        <tr key={item.id} className="border-t border-gray-100">
          <td className="px-2 py-3">
            <button
              type="button"
              onClick={() => setViewingEmail(item)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Inhalt anzeigen"
              aria-label="E-Mail-Inhalt anzeigen"
            >
              <EyeIcon className="h-5 w-5" />
            </button>
          </td>
          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
          <td className="px-4 py-3 text-sm text-gray-700">
            <SearchHighlight text={item.template} query={searchQuery} />
          </td>
          <td className="px-4 py-3 text-sm text-gray-900">
            <SearchHighlight text={item.subject} query={searchQuery} />
          </td>
          <td className="px-4 py-3 text-sm text-gray-700 break-all">
            <SearchHighlight text={item.toRecipients} query={searchQuery} />
          </td>
          <td className="px-4 py-3 text-sm whitespace-nowrap">
            <span className={getStatusClassName(item.status)}>{getStatusLabel(item.status)}</span>
          </td>
          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{item.attemptCount}</td>
          <td className="px-4 py-3 text-sm text-gray-700">
            {item.lastError ? item.lastError : "-"}
          </td>
          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
            {item.lastAttemptAt ? formatDateTime(item.lastAttemptAt) : "-"}
          </td>
          <td className="px-4 py-3 text-base text-gray-900 whitespace-nowrap">
            {canManage && canRetry ? (
              <button
                type="button"
                onClick={() => handleRetry(item.id)}
                className="btn-primary px-3 py-2 text-sm"
                disabled={retryingEmailId === item.id}
              >
                {retryingEmailId === item.id ? "Wird eingeplant…" : "Erneut senden"}
              </button>
            ) : (
              <span className="text-gray-500">-</span>
            )}
          </td>
        </tr>
      );
    });
  }, [canManage, handleRetry, items, retryingEmailId, searchQuery]);

  if (status === "loading" || isLoading) {
    return <LoadingScreen />;
  }

  const mobileList = items.length === 0 ? (
    <div className="border border-gray-200 rounded-md bg-white px-4 py-6 text-base text-gray-500 text-center">
      Keine E-Mails in den letzten 30 Tagen gefunden.
    </div>
  ) : (
    items.map((item) => {
      const canRetry = item.status === "FAILED";
      return (
        <article key={item.id} className="border border-gray-200 rounded-md bg-white p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-gray-500">{formatDateTime(item.createdAt)}</p>
              <p className={getStatusClassName(item.status)}>{getStatusLabel(item.status)}</p>
            </div>
            <button
              type="button"
              onClick={() => setViewingEmail(item)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Inhalt anzeigen"
              aria-label="E-Mail-Inhalt anzeigen"
            >
              <EyeIcon className="h-5 w-5" />
            </button>
          </div>
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
          {canManage && canRetry && (
            <button
              type="button"
              onClick={() => handleRetry(item.id)}
              className="btn-primary px-3 py-2 text-sm w-full"
              disabled={retryingEmailId === item.id}
            >
              {retryingEmailId === item.id ? "Wird eingeplant…" : "Erneut senden"}
            </button>
          )}
        </article>
      );
    })
  );

  return (
    <AdminListShell
      title="E-Mail-Versand"
      subtitle="Postausgang der letzten 30 Tage"
      listTitle="Versandverlauf"
      error={error}
      successMessage={actionMessage}
      total={total}
      searchPlaceholder="Suche nach Betreff, Empfänger oder Typ"
      searchInput={searchInput}
      onSearchInputChange={setSearchInput}
      onSubmitSearch={handleSubmitSearch}
      columns={OUTGOING_EMAIL_COLUMNS}
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
        isOpen={viewingEmail !== null}
        onClose={() => {
          setViewingEmail(null);
          setEmailContentTab("text");
        }}
        title="E-Mail-Inhalt"
        size="3xl"
      >
        {viewingEmail && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500">Empfänger</p>
                <p className="text-base font-medium text-gray-900 break-all">{viewingEmail.toRecipients}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className={`text-base font-semibold ${getStatusClassName(viewingEmail.status)}`}>
                  {getStatusLabel(viewingEmail.status)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">Betreff</p>
              <p className="text-base font-medium text-gray-900">{viewingEmail.subject}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">Inhalt</p>
              <div className="flex gap-1 mb-2">
                <button
                  type="button"
                  onClick={() => setEmailContentTab("text")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                    emailContentTab === "text"
                      ? "bg-brand-red-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setEmailContentTab("html")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                    emailContentTab === "html"
                      ? "bg-brand-red-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  HTML
                </button>
              </div>
              {emailContentTab === "text" ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {viewingEmail.textBody || <span className="text-gray-500 italic">Kein Text-Inhalt vorhanden</span>}
                </div>
              ) : (
                viewingEmail.htmlBody ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={viewingEmail.htmlBody}
                      sandbox=""
                      className="w-full h-64 border-0"
                      title="HTML-Vorschau"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800">
                    <span className="text-gray-500 italic">Kein HTML-Inhalt vorhanden</span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </Modal>
    </AdminListShell>
  );
}
