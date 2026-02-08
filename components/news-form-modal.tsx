"use client";

import { useMemo } from "react";
import { Modal } from "./modal";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { newsValidationConfig } from "@/lib/validation-schema";

export interface NewNews {
  title: string;
  content: string;
  published: boolean;
}

const initialNewNews: NewNews = {
  title: "",
  content: "",
  published: true,
};

interface NewsFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  newsData: NewNews;
  setNewsData: (data: NewNews) => void;
  isEditing: boolean;
  errors?: Record<string, string>;
  initialNewsData?: NewNews;
}

export function NewsFormModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  newsData,
  setNewsData,
  isEditing,
  errors = {},
  initialNewsData,
}: NewsFormModalProps) {
  const { errors: validationErrors, validateField, markFieldAsTouched, isFieldValid } = useFormFieldValidation(newsValidationConfig);

  const hasUnsavedChanges = useMemo(() => {
    const base = initialNewsData || initialNewNews;
    return (
      newsData.title !== base.title ||
      newsData.content !== base.content ||
      newsData.published !== base.published
    );
  }, [newsData, initialNewsData]);

  const combinedErrors = useMemo(() => {
    return { ...validationErrors, ...errors };
  }, [validationErrors, errors]);

  const handleChange = (name: string, value: string | boolean) => {
    setNewsData({ ...newsData, [name]: value });

    if (typeof value === "string" && validationErrors[name]) {
      validateField(name, value);
    }
  };

  const handleBlur = (name: string, value: string) => {
    markFieldAsTouched(name);
    validateField(name, value);
  };

  const shouldShowFieldError = (fieldName: string) => {
    const isServerError = !!errors[fieldName];
    if (isServerError) return combinedErrors[fieldName];
    // Show validation error if it exists, regardless of touched state (important for form submission)
    if (combinedErrors[fieldName]) return combinedErrors[fieldName];
    return undefined;
  };

  const handleClose = () => {
    if (hasUnsavedChanges && !isSubmitting) {
      if (confirm("Sie haben ungespeicherte Änderungen. Wirklich schließen?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const values = {
      title: newsData.title,
      content: newsData.content,
    };

    // Mark all fields as touched when submitting to show validation errors
    markFieldAsTouched("title");
    markFieldAsTouched("content");

    validateField("title", values.title);
    validateField("content", values.content);

    const isValid = isFieldValid("title", values.title) && isFieldValid("content", values.content);

    if (!isValid) {
      return;
    }

    onSubmit(e);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "News bearbeiten" : "Neue News erstellen"}
      size="lg"
      closeOnOutsideClick={false}
      closeOnEscape={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errors.general && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {errors.general}
          </div>
        )}
        <div>
          <label htmlFor="news-title" className="form-label">
            Titel *
          </label>
          <input
            id="news-title"
            type="text"
            value={newsData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            onBlur={(e) => handleBlur("title", e.target.value)}
            required
            maxLength={200}
            className={`form-input ${
              shouldShowFieldError("title") ? "border-red-500 focus:border-red-500" : ""
            }`}
            placeholder="Titel der News"
            disabled={isSubmitting}
            autoFocus={!isEditing}
            aria-invalid={!!shouldShowFieldError("title")}
            aria-describedby={shouldShowFieldError("title") ? "title-error" : undefined}
          />
          {shouldShowFieldError("title") && (
            <p id="title-error" className="form-help text-red-600">
              {combinedErrors.title}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="news-content" className="form-label">
            Inhalt *
          </label>
          <textarea
            id="news-content"
            value={newsData.content}
            onChange={(e) => handleChange("content", e.target.value)}
            onBlur={(e) => handleBlur("content", e.target.value)}
            required
            maxLength={10000}
            rows={10}
            className={`form-input ${
              shouldShowFieldError("content") ? "border-red-500 focus:border-red-500" : ""
            }`}
            placeholder="Inhalt der News..."
            disabled={isSubmitting}
            aria-invalid={!!shouldShowFieldError("content")}
            aria-describedby={shouldShowFieldError("content") ? "content-error" : undefined}
          />
          {shouldShowFieldError("content") && (
            <p id="content-error" className="form-help text-red-600">
              {combinedErrors.content}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            id="news-published"
            type="checkbox"
            checked={newsData.published}
            onChange={(e) => handleChange("published", e.target.checked)}
            className="h-4 w-4 text-brand-red-600 border-gray-300 rounded focus:ring-brand-red-600"
            disabled={isSubmitting}
          />
          <label htmlFor="news-published" className="text-base text-gray-700">
            Veröffentlichen
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 btn-outline py-2.5 text-base touch-manipulation"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 btn-primary py-2.5 text-base touch-manipulation"
          >
            {isSubmitting
              ? "Wird gespeichert..."
              : isEditing
              ? "Aktualisieren"
              : "Erstellen"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
