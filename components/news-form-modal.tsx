"use client";

import { useEffect, useMemo } from "react";
import { Modal } from "./modal";
import { LoadingButton } from "./loading-button";
import { GermanDatePicker } from "./german-date-picker";
import { ValidatedFieldGroup } from "./validated-field-group";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { mapServerErrorToField, NEWS_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { newsValidationConfig } from "@/lib/validation-schema";
import { getLocalDateString } from "@/lib/date-picker-utils";

export interface NewNews {
  newsDate: string;
  title: string;
  content: string;
  published: boolean;
}

function getTodayDateString() {
  return getLocalDateString();
}

const initialNewNews: NewNews = {
  newsDate: getTodayDateString(),
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
  const {
    errors: validationErrors,
    validateField,
    validateAllFields,
    markFieldAsTouched,
    shouldShowError,
    isValidAndTouched,
    reset,
  } = useFormFieldValidation(newsValidationConfig);

  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const inferredGeneralErrors = useMemo(() => {
    return mapServerErrorToField(errors.general || "", NEWS_FIELD_KEYWORDS);
  }, [errors.general]);

  const hasUnsavedChanges = useMemo(() => {
    const base = initialNewsData || initialNewNews;
    return (
      newsData.newsDate !== base.newsDate ||
      newsData.title !== base.title ||
      newsData.content !== base.content ||
      newsData.published !== base.published
    );
  }, [newsData, initialNewsData]);

  const combinedErrors = useMemo(() => {
    return { ...validationErrors, ...inferredGeneralErrors, ...errors };
  }, [validationErrors, inferredGeneralErrors, errors]);

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

  const getFieldError = (fieldName: string): string | undefined => {
    if (errors[fieldName]) return errors[fieldName];
    if (combinedErrors[fieldName] && shouldShowError(fieldName, newsData[fieldName as keyof typeof newsData] as string)) {
      return combinedErrors[fieldName];
    }
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

    const fieldValues: Record<string, string> = {
      newsDate: newsData.newsDate,
      title: newsData.title,
      content: newsData.content,
    };

    const isValid = validateAllFields(fieldValues);
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
        {errors.general && Object.keys(inferredGeneralErrors).length === 0 && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {errors.general}
          </div>
        )}
        <div>
          <GermanDatePicker
            id="news-date"
            label="Datum"
            value={newsData.newsDate}
            onChange={(date) => handleChange("newsDate", date)}
            onBlur={() => handleBlur("newsDate", newsData.newsDate)}
            required
            disabled={isSubmitting}
            error={getFieldError("newsDate")}
          />
        </div>
        <ValidatedFieldGroup
          label="Titel"
          name="title"
          type="text"
          value={newsData.title}
          onChange={(e) => handleChange("title", e.target.value)}
          onBlur={(e) => handleBlur("title", e.target.value)}
          error={getFieldError("title")}
          showSuccess={isValidAndTouched("title", newsData.title)}
          required
          maxLength={200}
          placeholder="Titel der News"
          disabled={isSubmitting}
          autoFocus={!isEditing}
        />

        <ValidatedFieldGroup
          as="textarea"
          label="Inhalt"
          name="content"
          value={newsData.content}
          onChange={(e) => handleChange("content", e.target.value)}
          onBlur={(e) => handleBlur("content", e.target.value)}
          error={getFieldError("content")}
          showSuccess={isValidAndTouched("content", newsData.content)}
          required
          maxLength={10000}
          rows={10}
          placeholder="Inhalt der News..."
          disabled={isSubmitting}
        />

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
          <LoadingButton
            type="submit"
            loading={isSubmitting}
            loadingText="Wird gespeichert..."
            className="flex-1 btn-primary py-2.5 text-base touch-manipulation"
          >
            {isEditing
              ? "Aktualisieren"
              : "Erstellen"}
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
}
