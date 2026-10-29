"use client";

import { useSession } from "next-auth/react";
import { canManageAdminArea } from "@/lib/role-utils";
import { useExternalEventManagement } from "@/lib/use-external-event-management";
import { splitExternalEventsByDate } from "@/lib/external-event-list";
import { formatPeriod } from "@/lib/dates";
import { getGermanDateString } from "@/lib/date-picker-utils";
import { API_ROUTES } from "@/lib/api-routes";
import { ExternalEventFormModal } from "@/components/external-event-form-modal";
import { VisibilityBadge } from "@/components/visibility-badge";
import { ExternalEventKindBadge } from "@/components/external-event-kind-badge";
import { BackLink } from "@/components/back-link";
import { LoadingScreen } from "@/components/loading-screen";
import { AlertBox } from "@/components/alert-box";
import { ExternalLinkIcon, PencilIcon, TrashIcon } from "@/components/icons";
import type { ExternalEventItem } from "@/types";

interface ExternalEventListProps {
  heading: string;
  externalEvents: ExternalEventItem[];
  canManage: boolean;
  onEdit: (externalEvent: ExternalEventItem) => void;
  onDelete: (id: string) => void;
}

function ExternalEventList({ heading, externalEvents, canManage, onEdit, onDelete }: ExternalEventListProps) {
  if (externalEvents.length === 0) return null;

  return (
    <section className="space-y-3" aria-label={heading}>
      <h2 className="text-lg font-semibold text-gray-900">{heading}</h2>
      {externalEvents.map((externalEvent) => (
        <div
          key={externalEvent.id}
          className="card-compact flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900">{externalEvent.title}</h3>
              {externalEvent.kind && <ExternalEventKindBadge kind={externalEvent.kind} />}
              <VisibilityBadge visibility={externalEvent.visibility} />
            </div>
            <p className="text-sm text-gray-600">
              {formatPeriod(externalEvent)}
              {externalEvent.location && ` · ${externalEvent.location}`}
            </p>
            {externalEvent.ausschreibung && (
              <p className="text-sm">
                <a
                  href={`${API_ROUTES.ADMIN.AUSSCHREIBUNGEN}/${externalEvent.ausschreibung.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-primary"
                >
                  Ausschreibung: {externalEvent.ausschreibung.title}
                </a>
              </p>
            )}
            {externalEvent.url && (
              <p className="text-sm">
                <a href={externalEvent.url} target="_blank" rel="noopener noreferrer" className="link-primary inline-flex items-center gap-1">
                  Weitere Informationen <ExternalLinkIcon className="h-4 w-4" />
                </a>
              </p>
            )}
          </div>
          {canManage && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onEdit(externalEvent)}
                className="btn-icon"
                aria-label={`Fremdtermin bearbeiten: ${externalEvent.title}`}
                title="Bearbeiten"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(externalEvent.id)}
                className="btn-icon-danger"
                aria-label={`Fremdtermin löschen: ${externalEvent.title}`}
                title="Löschen"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export default function FremdterminePage() {
  const { data: session, status } = useSession();
  const management = useExternalEventManagement();
  const canManage = canManageAdminArea(session?.user);

  if (status === "loading" || management.isLoading) {
    return <LoadingScreen />;
  }

  const { externalEvents, error, success, handleDelete, form } = management;

  const { upcoming, past } = splitExternalEventsByDate(externalEvents, getGermanDateString());

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <BackLink href="/admin/dashboard" className="text-base">Zurück zum Dashboard</BackLink>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Fremdtermine</h1>
            <p className="text-base text-gray-600 mt-1">
              Verwalten Sie Fremdtermine wie RDL, RK-Veranstaltungen und externe Wettkämpfe.
            </p>
          </div>
          {canManage && (
            <button onClick={() => form.openCreate()} className="btn-primary whitespace-nowrap">
              + Neuer Fremdtermin
            </button>
          )}
        </div>

        <AlertBox type="success" message={success} className="mb-4" />

        <AlertBox type="error" message={error} className="mb-4" />

        {externalEvents.length === 0 ? (
          <div className="card text-center text-gray-500 py-12">
            Keine Fremdtermine vorhanden.{canManage && " Erstellen Sie den ersten Fremdtermin."}
          </div>
        ) : (
          <div className="space-y-8">
            <ExternalEventList
              heading="Kommende Fremdtermine"
              externalEvents={upcoming}
              canManage={canManage}
              onEdit={form.openEdit}
              onDelete={handleDelete}
            />
            <ExternalEventList
              heading="Vergangene Fremdtermine"
              externalEvents={past}
              canManage={canManage}
              onEdit={form.openEdit}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>

      {canManage && (
        <ExternalEventFormModal
          isOpen={form.isOpen}
          onClose={form.close}
          onSubmit={form.handleSubmit}
          isSubmitting={form.isSubmitting}
          data={form.data}
          setData={form.setData}
          isEditing={!!form.editingExternalEvent}
          errors={form.error ? { general: form.error } : {}}
          fieldErrors={form.fieldErrors}
          initialData={form.initialData}
          currentAusschreibung={form.editingExternalEvent?.ausschreibung}
        />
      )}
    </main>
  );
}
