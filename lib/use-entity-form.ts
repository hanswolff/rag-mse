import { useCallback, useState, type FormEvent } from "react";
import { ApiError, apiFetch, toDisplayErrorMessage } from "@/lib/api-fetch";
import type { FieldError } from "@/lib/server-error-mapper";

export type EntitySaveMode = "created" | "updated";

interface EntityFormOptions<TItem, TForm, TSource extends { id: string }> {
  endpoint: string;
  emptyForm: TForm;
  toForm: (item: TSource) => TForm;
  onSaved: (saved: TItem, mode: EntitySaveMode) => void | Promise<void>;
}

export function useEntityForm<TItem extends { id: string }, TForm, TSource extends { id: string } = TItem>({
  endpoint,
  emptyForm,
  toForm,
  onSaved,
}: EntityFormOptions<TItem, TForm, TSource>) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<TSource | null>(null);
  const [data, setData] = useState<TForm>(emptyForm);
  const [initialData, setInitialData] = useState<TForm | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);

  const show = useCallback((form: TForm, item: TSource | null, initial?: TForm) => {
    setData(form);
    setEditing(item);
    setInitialData(initial);
    setError("");
    setFieldErrors([]);
    setIsOpen(true);
  }, []);

  const openCreate = useCallback(
    (defaults: Partial<TForm> = {}) => show({ ...emptyForm, ...defaults }, null),
    [show, emptyForm]
  );

  const openEdit = useCallback((item: TSource) => {
    const form = toForm(item);
    show(form, item, form);
  }, [show, toForm]);

  const close = useCallback(() => {
    setIsOpen(false);
    setEditing(null);
    setData(emptyForm);
    setInitialData(undefined);
    setError("");
    setFieldErrors([]);
  }, [emptyForm]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors([]);
    setIsSubmitting(true);
    try {
      const saved = await apiFetch<TItem>(
        editing ? `${endpoint}/${editing.id}` : endpoint,
        { method: editing ? "PUT" : "POST", body: data }
      );
      const mode: EntitySaveMode = editing ? "updated" : "created";
      close();
      await onSaved(saved, mode);
    } catch (err: unknown) {
      setError(toDisplayErrorMessage(err));
      if (err instanceof ApiError && err.fieldErrors) setFieldErrors(err.fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  }, [editing, endpoint, data, close, onSaved]);

  return {
    isOpen,
    editing,
    data,
    setData,
    initialData,
    isSubmitting,
    error,
    fieldErrors,
    openCreate,
    openEdit,
    close,
    handleSubmit,
  };
}
