import { useState, useCallback, useEffect } from "react";
import { useAdminAuth } from "./use-admin-auth";
import { useAdminCrud } from "./use-admin-crud";
import { useSuccessTimer } from "./use-success-timer";
import { isAdmin } from "@/lib/role-utils";
import { EMPTY_SHOOTING_RANGE } from "@/types";
import type { ShootingRangeItem, NewShootingRange } from "@/types";
import type { FieldError } from "@/lib/server-error-mapper";

export function useRangeManagement() {
  const { session, status } = useAdminAuth();
  const { createFetchHandler, createDeleteHandler } = useAdminCrud();

  const [ranges, setRanges] = useState<ShootingRangeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeSuccess, setGeocodeSuccess] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [success, setSuccess] = useState("");
  const [editingRange, setEditingRange] = useState<ShootingRangeItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalRangeData, setModalRangeData] = useState<NewShootingRange>(EMPTY_SHOOTING_RANGE);
  const [initialRangeData, setInitialRangeData] = useState<NewShootingRange | undefined>(undefined);

  useSuccessTimer(success, setSuccess);

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
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isAdmin(session?.user)) {
      void fetchRanges();
    }
  }, [status, session, fetchRanges]);

  const createRange = createFetchHandler<NewShootingRange>(
    "/api/admin/ranges",
    "POST",
    setError,
    setIsSubmitting,
    modalRangeData
  );

  const updateRange = createFetchHandler<NewShootingRange>(
    "/api/admin/ranges",
    "PUT",
    setError,
    setIsSubmitting,
    modalRangeData
  );

  const deleteRange = createFetchHandler(
    "/api/admin/ranges",
    "DELETE",
    setError,
    setIsSubmitting
  );

  const handleCreateRange = useCallback(async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setFieldErrors([]);
    const result = await createRange();
    if (result.success) {
      setSuccess("Standort wurde erfolgreich erstellt");
      setIsModalOpen(false);
      setModalRangeData(EMPTY_SHOOTING_RANGE);
      setEditingRange(null);
      await fetchRanges();
    } else if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
    }
  }, [createRange, fetchRanges]);

  const handleUpdateRange = useCallback(async (e: React.FormEvent) => {
    if (!editingRange) return;
    if (e) e.preventDefault();
    setFieldErrors([]);
    const result = await updateRange(editingRange.id);
    if (result.success) {
      setSuccess("Standort wurde erfolgreich aktualisiert");
      setIsModalOpen(false);
      setModalRangeData(EMPTY_SHOOTING_RANGE);
      setEditingRange(null);
      await fetchRanges();
    } else if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
    }
  }, [editingRange, updateRange, fetchRanges]);

  const handleDeleteRange = createDeleteHandler(
    deleteRange,
    setSuccess,
    "Standort wurde erfolgreich gelöscht",
    () => fetchRanges()
  );

  const startEditingRange = useCallback((range: ShootingRangeItem) => {
    setEditingRange(range);
    const rangeData: NewShootingRange = {
      name: range.name,
      street: range.street || "",
      postalCode: range.postalCode || "",
      city: range.city || "",
      latitude: range.latitude.toString(),
      longitude: range.longitude.toString(),
    };
    setModalRangeData(rangeData);
    setInitialRangeData(rangeData);
    setError("");
    setFieldErrors([]);
    setIsModalOpen(true);
  }, []);

  const openCreateModal = useCallback(() => {
    setModalRangeData(EMPTY_SHOOTING_RANGE);
    setEditingRange(null);
    setInitialRangeData(undefined);
    setError("");
    setFieldErrors([]);
    setGeocodeSuccess(false);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalRangeData(EMPTY_SHOOTING_RANGE);
    setInitialRangeData(undefined);
    setEditingRange(null);
    setGeocodeSuccess(false);
    setError("");
    setFieldErrors([]);
  }, []);

  const handleGeocode = useCallback(async () => {
    const addressParts = [
      modalRangeData.street,
      modalRangeData.postalCode,
      modalRangeData.city,
      modalRangeData.name,
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

      setModalRangeData((prev) => ({
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
  }, [modalRangeData]);

  return {
    ranges,
    isLoading,
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
  };
}
