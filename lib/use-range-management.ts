import { useState, useCallback, useEffect, useRef } from "react";
import { useAdminAuth } from "./use-admin-auth";
import { useAdminEntityManagement } from "./use-admin-entity-management";
import { canAccessAdminArea } from "@/lib/role-utils";
import { EMPTY_SHOOTING_RANGE } from "@/types";
import type { ShootingRangeItem, NewShootingRange } from "@/types";

export function useRangeManagement() {
  const { session, status } = useAdminAuth();

  const [ranges, setRanges] = useState<ShootingRangeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeSuccess, setGeocodeSuccess] = useState(false);

  const fetchRangesRef = useRef<() => Promise<void> | void>(() => {});

  const management = useAdminEntityManagement<ShootingRangeItem, NewShootingRange>({
    endpoint: "/api/admin/ranges",
    emptyForm: EMPTY_SHOOTING_RANGE,
    itemToForm: (range) => ({
      name: range.name,
      street: range.street || "",
      postalCode: range.postalCode || "",
      city: range.city || "",
      latitude: range.latitude.toString(),
      longitude: range.longitude.toString(),
    }),
    messages: {
      created: "Standort wurde erfolgreich erstellt",
      updated: "Standort wurde erfolgreich aktualisiert",
      deleted: "Standort wurde erfolgreich gelöscht",
    },
    refetch: () => fetchRangesRef.current(),
  });

  const {
    setError,
    setModalData,
    modalData,
    openCreateModal: baseOpenCreateModal,
    closeModal: baseCloseModal,
  } = management;

  const fetchRanges = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/ranges");
      if (!response.ok) throw new Error("Fehler beim Laden der Standorte");
      const data = await response.json();
      setRanges(data.ranges ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    fetchRangesRef.current = fetchRanges;
  }, [fetchRanges]);

  useEffect(() => {
    if (status === "authenticated" && canAccessAdminArea(session?.user)) {
      void fetchRanges();
    }
  }, [status, session, fetchRanges]);

  const openCreateModal = useCallback(() => {
    setGeocodeSuccess(false);
    baseOpenCreateModal();
  }, [baseOpenCreateModal]);

  const closeModal = useCallback(() => {
    setGeocodeSuccess(false);
    baseCloseModal();
  }, [baseCloseModal]);

  const handleGeocode = useCallback(async () => {
    const addressParts = [
      modalData.street,
      modalData.postalCode,
      modalData.city,
      modalData.name,
    ].filter(Boolean);

    const query = addressParts.join(", ");
    if (query.trim().length < 3) {
      setError("Bitte geben Sie eine Adresse mit mindestens 3 Zeichen ein");
      return;
    }

    setIsGeocoding(true);
    setGeocodeSuccess(false);
    setError("");

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Fehler beim Geocoding");

      setModalData((prev) => ({
        ...prev,
        latitude: data.latitude.toString(),
        longitude: data.longitude.toString(),
      }));
      setGeocodeSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsGeocoding(false);
    }
  }, [modalData, setError, setModalData]);

  return {
    ranges,
    isLoading,
    isSubmitting: management.isCreating || management.isUpdating || management.isDeleting,
    isGeocoding,
    geocodeSuccess,
    error: management.error,
    fieldErrors: management.fieldErrors,
    success: management.success,
    editingRange: management.editingItem,
    modalRangeData: management.modalData,
    setModalRangeData: management.setModalData,
    initialRangeData: management.initialData,
    isModalOpen: management.isModalOpen,
    handleCreateRange: management.handleCreate,
    handleUpdateRange: management.handleUpdate,
    handleDeleteRange: management.handleDelete,
    startEditingRange: management.startEditing,
    openCreateModal,
    closeModal,
    handleGeocode,
  };
}
