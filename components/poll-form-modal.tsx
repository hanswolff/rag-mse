"use client";

import { type FormEvent, useEffect, useState, useCallback } from "react";
import { Modal } from "@/components/modal";
import { ConfirmCloseModal } from "@/components/confirm-close-modal";
import { AlertBox } from "@/components/alert-box";
import { LoadingButton } from "@/components/loading-button";
import { useFormModal } from "@/lib/use-form-modal";
import { pollValidationConfig } from "@/lib/validation-schema";
import { API_ROUTES } from "@/lib/api-routes";
import type { NewPollData } from "@/lib/use-poll-management";

interface EventOption {
  id: string;
  date: string;
  description: string;
}

interface PollFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  isSubmitting: boolean;
  pollData: NewPollData;
  setPollData: (data: NewPollData) => void;
  initialPollData?: NewPollData;
  isEditing: boolean;
  error?: string;
}

function formatEventDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
  } catch {
    return dateStr;
  }
}

function getEventDescriptionPreview(description: string) {
  const text = description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 60 ? text.slice(0, 60) + "…" : text;
}

export function PollFormModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  pollData,
  setPollData,
  initialPollData,
  isEditing,
  error,
}: PollFormModalProps) {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [optionErrors, setOptionErrors] = useState<Record<number, string>>({});
  const [eventError, setEventError] = useState("");

  const loadEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const response = await fetch(`${API_ROUTES.ADMIN.EVENTS}?limit=100`);
      const data = await response.json();
      setEvents(
        (data.events || []).map((event: { id: string; date: string; description: string }) => ({
          id: event.id,
          date: event.date,
          description: event.description,
        }))
      );
    } catch {
      setEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  const validateOptions = (): boolean => {
    const errs: Record<number, string> = {};
    pollData.options.forEach((opt, i) => {
      const result = pollValidationConfig.option.zod.safeParse(opt.text.trim());
      if (!result.success) {
        errs[i] = result.error.issues[0]?.message || "Ungültig";
      }
    });
    setOptionErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const {
    handleChange,
    handleBlur,
    handleClose,
    handleSubmit,
    shouldShowError,
    validationErrors,
    showCloseConfirm,
    handleConfirmClose,
    cancelClose,
  } = useFormModal<NewPollData>({
    validationConfig: pollValidationConfig,
    formData: pollData,
    setFormData: setPollData,
    defaultData: initialPollData,
    initialData: initialPollData,
    isOpen,
    isSubmitting,
    onClose,
    onSubmit,
    getFieldValues: (data) => ({ title: data.title }),
    extraValidation: () => {
      const optionsValid = validateOptions();
      if (pollData.type === "TERMIN" && !isEditing && !pollData.eventId) {
        setEventError("Bitte wählen Sie einen Termin aus");
        return false;
      }
      setEventError("");
      return optionsValid;
    },
  });

  useEffect(() => {
    if (isOpen) {
      setEventError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && pollData.type === "TERMIN") {
      void loadEvents();
    }
  }, [isOpen, pollData.type, loadEvents]);

  const updateOption = (index: number, text: string) => {
    const newOptions = [...pollData.options];
    newOptions[index] = { ...newOptions[index], text };
    setPollData({ ...pollData, options: newOptions });
    if (optionErrors[index]) {
      const result = pollValidationConfig.option.zod.safeParse(text.trim());
      if (result.success) {
        setOptionErrors((prev) => { const next = { ...prev }; delete next[index]; return next; });
      }
    }
  };

  const addOption = () => {
    setOptionErrors({});
    setPollData({
      ...pollData,
      options: [...pollData.options, { text: "", position: pollData.options.length }],
    });
  };

  const removeOption = (index: number) => {
    if (pollData.options.length <= 2) return;
    setOptionErrors({});
    const newOptions = pollData.options
      .filter((_, i) => i !== index)
      .map((o, i) => ({ ...o, position: i }));
    setPollData({ ...pollData, options: newOptions });
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= pollData.options.length) return;
    setOptionErrors({});
    const newOptions = [...pollData.options];
    [newOptions[index], newOptions[newIndex]] = [newOptions[newIndex], newOptions[index]];
    setPollData({
      ...pollData,
      options: newOptions.map((o, i) => ({ ...o, position: i })),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "Umfrage bearbeiten" : "Neue Umfrage erstellen"}
      closeOnOutsideClick={false}
      closeOnEscape={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AlertBox type="error" message={error} />

        <div>
          <label htmlFor="poll-title" className="form-label">Titel *</label>
          <input
            id="poll-title"
            type="text"
            value={pollData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            onBlur={() => handleBlur("title", pollData.title)}
            className={`form-input ${shouldShowError("title", pollData.title) ? "border-red-500" : ""}`}
            aria-invalid={shouldShowError("title", pollData.title) || undefined}
            aria-describedby={shouldShowError("title", pollData.title) ? "poll-title-error" : undefined}
            maxLength={200}
            disabled={isSubmitting}
            autoFocus
          />
          {shouldShowError("title", pollData.title) && (
            <p id="poll-title-error" className="text-sm text-red-600 mt-1">{validationErrors.title}</p>
          )}
        </div>

        <div>
          <label htmlFor="poll-description" className="form-label">Beschreibung</label>
          <textarea
            id="poll-description"
            value={pollData.description}
            onChange={(e) => setPollData({ ...pollData, description: e.target.value })}
            className="form-input"
            rows={3}
            maxLength={2000}
            disabled={isSubmitting}
          />
        </div>

        {!isEditing && (
          <div>
            <label htmlFor="poll-type" className="form-label">Typ *</label>
            <select
              id="poll-type"
              value={pollData.type}
              onChange={(e) => setPollData({ ...pollData, type: e.target.value as "TERMIN" | "SONSTIGES", eventId: "" })}
              className="form-input"
              disabled={isSubmitting}
            >
              <option value="SONSTIGES">Sonstiges</option>
              <option value="TERMIN">Termin</option>
            </select>
          </div>
        )}

        {!isEditing && pollData.type === "TERMIN" && (
          <div>
            <label htmlFor="poll-event" className="form-label">Termin *</label>
            {isLoadingEvents ? (
              <p className="text-gray-500">Termine werden geladen...</p>
            ) : (
              <select
                id="poll-event"
                value={pollData.eventId}
                onChange={(e) => {
                  setPollData({ ...pollData, eventId: e.target.value });
                  if (e.target.value) setEventError("");
                }}
                className={`form-input ${eventError ? "border-red-500" : ""}`}
                aria-invalid={eventError ? true : undefined}
                aria-describedby={eventError ? "poll-event-error" : undefined}
                disabled={isSubmitting}
              >
                <option value="">Bitte wählen</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {formatEventDate(event.date)} – {getEventDescriptionPreview(event.description)}
                  </option>
                ))}
              </select>
            )}
            {eventError && (
              <p id="poll-event-error" className="text-sm text-red-600 mt-1" role="alert">{eventError}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            id="poll-multiple-choice"
            type="checkbox"
            checked={pollData.multipleChoice}
            onChange={(e) => setPollData({ ...pollData, multipleChoice: e.target.checked })}
            disabled={isSubmitting}
            className="h-5 w-5 rounded border-gray-300 text-brand-red-700 focus:ring-brand-red-600"
          />
          <label htmlFor="poll-multiple-choice" className="font-semibold text-gray-900">
            Mehrfachauswahl erlauben
          </label>
        </div>

        <div>
          <label className="form-label">Optionen *</label>
          <div className="space-y-2">
            {pollData.options.map((opt, index) => (
              <div key={index}>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm w-6 text-right">{index + 1}.</span>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOption(index, e.target.value)}
                    className={`form-input flex-1 ${optionErrors[index] ? "border-red-500" : ""}`}
                    aria-invalid={!!optionErrors[index] || undefined}
                    placeholder={`Option ${index + 1}`}
                    maxLength={200}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => moveOption(index, -1)}
                    disabled={index === 0 || isSubmitting}
                    className="px-2 py-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                    title="Nach oben"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveOption(index, 1)}
                    disabled={index === pollData.options.length - 1 || isSubmitting}
                    className="px-2 py-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                    title="Nach unten"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    disabled={pollData.options.length <= 2 || isSubmitting}
                    className="px-2 py-1 text-red-500 hover:text-red-700 disabled:opacity-30"
                    title="Entfernen"
                  >
                    ✕
                  </button>
                </div>
                {optionErrors[index] && (
                  <p className="text-sm text-red-600 mt-1 ml-8">{optionErrors[index]}</p>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            disabled={pollData.options.length >= 20 || isSubmitting}
            className="mt-2 text-sm text-brand-red-700 hover:text-brand-red-800 font-semibold disabled:opacity-30"
          >
            + Option hinzufügen
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="btn-outline"
          >
            Abbrechen
          </button>
          <LoadingButton
            type="submit"
            loading={isSubmitting}
            loadingText="Speichern..."
            className="btn-primary"
          >
            {isEditing ? "Speichern" : "Erstellen"}
          </LoadingButton>
        </div>
      </form>
      <ConfirmCloseModal
        isOpen={showCloseConfirm}
        onConfirm={handleConfirmClose}
        onCancel={cancelClose}
      />
    </Modal>
  );
}
