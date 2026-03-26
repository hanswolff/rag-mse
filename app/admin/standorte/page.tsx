"use client";

import { useSession } from "next-auth/react";
import { useRangeManagement } from "@/lib/use-range-management";
import { RangeFormModal } from "@/components/range-form-modal";
import { BackLink } from "@/components/back-link";
import { LoadingScreen } from "@/components/loading-screen";
import type { ShootingRangeItem } from "@/types";
import { AlertBox } from "@/components/alert-box";

function formatAddress(range: ShootingRangeItem): string {
  const line1 = range.street || "";
  const line2 = [range.postalCode, range.city].filter(Boolean).join(" ").trim();
  if (line1 && line2) return `${line1}, ${line2}`;
  return line1 || line2 || "";
}

export default function StandortePage() {
  const { status } = useSession();
  const rangeManagement = useRangeManagement();

  if (status === "loading" || rangeManagement.isLoading) {
    return <LoadingScreen />;
  }

  const {
    ranges,
    isSubmitting,
    isGeocoding,
    geocodeSuccess,
    error,
    fieldErrors,
    success,
    editingRange,
    modalRangeData,
    setModalRangeData,
    initialRangeData,
    isModalOpen,
    handleCreateRange,
    handleUpdateRange,
    handleDeleteRange,
    startEditingRange,
    openCreateModal,
    closeModal,
    handleGeocode,
  } = rangeManagement;

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <BackLink href="/admin/dashboard" className="text-base">Zurück zum Dashboard</BackLink>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Standorte</h1>
            <p className="text-base text-gray-600 mt-1">
              Verwalten Sie Schießstände und deren Adressdaten.
            </p>
          </div>
          <button onClick={openCreateModal} className="btn-primary whitespace-nowrap">
            + Neuer Schießstand
          </button>
        </div>

        <AlertBox type="success" message={success} className="mb-4" />

        {!isModalOpen && (
          <AlertBox type="error" message={error} className="mb-4" />
        )}

        {ranges.length === 0 ? (
          <div className="card text-center text-gray-500 py-12">
            Keine Schießstände vorhanden. Erstellen Sie den ersten Schießstand.
          </div>
        ) : (
          <div className="space-y-3">
            {ranges.map((range) => (
              <div
                key={range.id}
                className="card-compact flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{range.name}</h3>
                  {formatAddress(range) && (
                    <p className="text-sm text-gray-600 mt-0.5 truncate">{formatAddress(range)}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {range.latitude.toFixed(4)}, {range.longitude.toFixed(4)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEditingRange(range)}
                    className="btn-icon"
                    title="Bearbeiten"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteRange(range.id)}
                    className="btn-icon-danger"
                    title="Löschen"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RangeFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={editingRange ? handleUpdateRange : handleCreateRange}
        isSubmitting={isSubmitting}
        rangeData={modalRangeData}
        setRangeData={setModalRangeData}
        isEditing={!!editingRange}
        errors={error && isModalOpen ? { general: error } : {}}
        fieldErrors={fieldErrors}
        initialRangeData={initialRangeData}
        isGeocoding={isGeocoding}
        onGeocode={handleGeocode}
        geocodeSuccess={geocodeSuccess}
      />
    </main>
  );
}
