"use client";

import Link from "next/link";
import { isAdmin } from "@/lib/role-utils";
import { usePollManagement } from "@/lib/use-poll-management";
import { LoadingScreen } from "@/components/loading-screen";
import { PollFormModal } from "@/components/poll-form-modal";
import { getPollStatusLabel, getPollTypeLabel } from "@/lib/poll-labels";
import { AlertBox } from "@/components/alert-box";
import { CopyLinkButton } from "@/components/copy-link-button";
import { EyeIcon, TrashIcon } from "@/components/icons";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    LIVE: "bg-green-100 text-green-800",
    CLOSED: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-0.5 text-sm font-medium rounded ${colorMap[status] || "bg-gray-100 text-gray-800"}`}>
      {getPollStatusLabel(status)}
    </span>
  );
}

export default function AdminPollsPage() {
  const {
    polls,
    isLoading,
    error,
    success,
    isModalOpen,
    modalPollData,
    setModalPollData,
    editingPoll,
    isSubmitting,
    publishingPollId,
    closingPollId,
    reopeningPollId,
    session,
    status,
    openCreateModal,
    openEditModal,
    closeModal,
    handleSubmit,
    handleDelete,
    handlePublish,
    handleClose,
    handleReopen,
    setError,
    setSuccess,
  } = usePollManagement();

  const canManage = isAdmin(session?.user);

  if (status === "loading" || isLoading) {
    return <LoadingScreen />;
  }

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Umfragen</h1>
            <p className="text-gray-600 mt-1">Umfragen erstellen und verwalten</p>
          </div>
          {canManage && (
            <button type="button" onClick={openCreateModal} className="btn-primary">
              Neue Umfrage
            </button>
          )}
        </div>

        <AlertBox type="error" message={error} className="mb-4" onDismiss={() => setError("")} />

        <AlertBox type="success" message={success} className="mb-4" onDismiss={() => setSuccess("")} />

        {polls.length === 0 ? (
          <div className="card empty-state">
            <p className="text-gray-500 text-lg font-medium">Keine Umfragen vorhanden</p>
            <p className="text-gray-400 text-sm mt-1">Erstellen Sie eine neue Umfrage</p>
          </div>
        ) : (
          <div className="space-y-4">
            {polls.map((poll) => (
              <div key={poll.id} className="card-compact p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h2 className="text-lg font-semibold text-gray-900">{poll.title}</h2>
                      <StatusBadge status={poll.status} />
                      <span className="px-2 py-0.5 text-sm font-medium rounded bg-brand-blue-50 text-brand-blue-800">
                        {getPollTypeLabel(poll.type)}
                      </span>
                      {poll.multipleChoice && (
                        <span className="px-2 py-0.5 text-sm font-medium rounded bg-purple-50 text-purple-800">
                          Mehrfachauswahl
                        </span>
                      )}
                    </div>
                    {poll.description && (
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">{poll.description}</p>
                    )}
                    <div className="text-sm text-gray-500 mt-2 space-x-4">
                      <span>{poll.options.length} Optionen</span>
                      <span>{poll._count?.votes || 0} Stimmen</span>
                      {poll.shortCode && (
                        <CopyLinkButton
                          url={`${siteUrl}/u/${poll.shortCode}`}
                          compact
                        />
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Link
                        href={`/umfragen/${poll.id}`}
                        className="inline-flex items-center justify-center w-9 h-9 rounded bg-brand-blue-50 text-brand-blue-800 hover:bg-brand-blue-100 transition-colors"
                        title="Ansehen"
                      >
                        <EyeIcon className="w-5 h-5" />
                      </Link>
                      {poll.status === "DRAFT" && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(poll)}
                            className="btn-outline text-sm"
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            onClick={() => void handlePublish(poll.id)}
                            disabled={publishingPollId === poll.id}
                            className="btn-primary text-sm"
                          >
                            {publishingPollId === poll.id ? "Wird veröffentlicht..." : "Veröffentlichen"}
                          </button>
                        </>
                      )}
                      {poll.status === "LIVE" && (
                        <button
                          type="button"
                          onClick={() => void handleClose(poll.id)}
                          disabled={closingPollId === poll.id}
                          className="btn-outline text-sm border-red-300 text-red-700 hover:bg-red-50"
                        >
                          {closingPollId === poll.id ? "Wird geschlossen..." : "Schließen"}
                        </button>
                      )}
                      {poll.status === "CLOSED" && (
                        <button
                          type="button"
                          onClick={() => void handleReopen(poll.id)}
                          disabled={reopeningPollId === poll.id}
                          className="btn-outline text-sm border-green-300 text-green-700 hover:bg-green-50"
                        >
                          {reopeningPollId === poll.id ? "Wird geöffnet..." : "Wieder öffnen"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(poll.id)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                        title="Löschen"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PollFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        pollData={modalPollData}
        setPollData={setModalPollData}
        isEditing={!!editingPoll}
        error={error}
      />
    </main>
  );
}
