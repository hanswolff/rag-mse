import { useState, useCallback } from "react";
import { useAdminCrud } from "./use-admin-crud";
import { useSuccessTimer } from "./use-success-timer";
import type { FieldError } from "@/lib/server-error-mapper";

type SuccessMessage = string | ((data: unknown) => string);

function resolveMessage(message: SuccessMessage, data: unknown): string {
  return typeof message === "function" ? message(data) : message;
}

export interface UseAdminEntityManagementOptions<TItem extends { id: string }, TForm> {
  endpoint: string;
  emptyForm: TForm;
  itemToForm: (item: TItem) => TForm;
  updateMethod?: "PUT" | "PATCH";
  messages: {
    created: SuccessMessage;
    updated: SuccessMessage;
    deleted: string;
  };
  /** Wird nach erfolgreichem Update/Delete aufgerufen (und nach Create, falls kein refetchAfterCreate gesetzt ist). */
  refetch: () => Promise<void> | void;
  /** Abweichender Refetch nach erfolgreichem Anlegen (z. B. Sprung auf Seite 1). */
  refetchAfterCreate?: () => Promise<void> | void;
}

/**
 * Gemeinsames Gerüst der Admin-Verwaltungs-Hooks: Modal-Lebenszyklus
 * (editingItem/isModalOpen/modalData/initialData mit Reset-Kaskaden) plus
 * Create/Update/Delete mit fieldErrors, Erfolgsmeldung und Refetch.
 * Stand zuvor fünffach kopiert in use-{event,user,news,range,poll}-management.
 */
export function useAdminEntityManagement<TItem extends { id: string }, TForm>({
  endpoint,
  emptyForm,
  itemToForm,
  updateMethod = "PUT",
  messages,
  refetch,
  refetchAfterCreate,
}: UseAdminEntityManagementOptions<TItem, TForm>) {
  const { createFetchHandler, createDeleteHandler } = useAdminCrud();

  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [success, setSuccess] = useState("");
  const [editingItem, setEditingItem] = useState<TItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<TForm>(emptyForm);
  const [initialData, setInitialData] = useState<TForm | undefined>(undefined);

  useSuccessTimer(success, setSuccess);

  const createItem = createFetchHandler<TForm>(endpoint, "POST", setError, setIsCreating, modalData);
  const updateItem = createFetchHandler<TForm>(endpoint, updateMethod, setError, setIsUpdating, modalData);
  const deleteItem = createFetchHandler(endpoint, "DELETE", setError, setIsDeleting);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    if (e) e.preventDefault();

    setFieldErrors([]);
    const result = await createItem();
    if (result.success) {
      setSuccess(resolveMessage(messages.created, result.data));
      setIsModalOpen(false);
      setModalData(emptyForm);
      setEditingItem(null);
      await (refetchAfterCreate ?? refetch)();
    } else if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
    }
  }, [createItem, messages.created, emptyForm, refetch, refetchAfterCreate]);

  const handleUpdate = useCallback(async (e: React.FormEvent) => {
    if (!editingItem) return;
    if (e) e.preventDefault();

    setFieldErrors([]);
    const result = await updateItem(editingItem.id);
    if (result.success) {
      setSuccess(resolveMessage(messages.updated, result.data));
      setIsModalOpen(false);
      setModalData(emptyForm);
      setEditingItem(null);
      await refetch();
    } else if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
    }
  }, [editingItem, updateItem, messages.updated, emptyForm, refetch]);

  const handleDelete = createDeleteHandler(
    deleteItem,
    setSuccess,
    messages.deleted,
    () => refetch()
  );

  const startEditing = useCallback((item: TItem) => {
    setEditingItem(item);
    const formData = itemToForm(item);
    setModalData(formData);
    setInitialData(formData);
    setError("");
    setFieldErrors([]);
    setIsModalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- itemToForm ist eine reine Abbildung des Aufrufers
  }, []);

  const openCreateModal = useCallback(() => {
    setModalData(emptyForm);
    setEditingItem(null);
    setInitialData(undefined);
    setError("");
    setFieldErrors([]);
    setIsModalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emptyForm ist eine stabile Konstante des Aufrufers
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalData(emptyForm);
    setInitialData(undefined);
    setEditingItem(null);
    setError("");
    setFieldErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emptyForm ist eine stabile Konstante des Aufrufers
  }, []);

  return {
    isCreating,
    isUpdating,
    isDeleting,
    error,
    setError,
    fieldErrors,
    success,
    setSuccess,
    editingItem,
    isModalOpen,
    modalData,
    setModalData,
    initialData,
    handleCreate,
    handleUpdate,
    handleDelete,
    startEditing,
    openCreateModal,
    closeModal,
  };
}
