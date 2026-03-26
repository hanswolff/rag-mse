"use client";

import { Modal } from "./modal";
import { ConfirmCloseModal } from "./confirm-close-modal";
import { LoadingButton } from "./loading-button";
import { GermanDatePicker } from "./german-date-picker";
import { ValidatedFieldGroup } from "./validated-field-group";
import { useFormModal } from "@/lib/use-form-modal";
import { NEWS_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import type { FieldError } from "@/lib/server-error-mapper";
import { newsValidationConfig } from "@/lib/validation-schema";
import { getLocalDateString } from "@/lib/date-picker-utils";
import { AlertBox } from "./alert-box";

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
  fieldErrors?: FieldError[];
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
  fieldErrors,
  initialNewsData,
}: NewsFormModalProps) {
  const {
    getFieldError,
    handleChange,
    handleBlur,
    handleClose,
    handleSubmit,
    generalErrors,
    showCloseConfirm,
    handleConfirmClose,
    cancelClose,
    isValidAndTouched,
  } = useFormModal<NewNews>({
    validationConfig: newsValidationConfig,
    formData: newsData,
    setFormData: setNewsData,
    defaultData: initialNewNews,
    initialData: initialNewsData,
    isOpen,
    isSubmitting,
    onClose,
    onSubmit,
    serverErrors: errors,
    fieldErrors,
    fieldKeywords: NEWS_FIELD_KEYWORDS,
  });

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
        {Object.keys(generalErrors).length === 0 && (
          <AlertBox type="error" message={errors.general} />
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
      <ConfirmCloseModal
        isOpen={showCloseConfirm}
        onConfirm={handleConfirmClose}
        onCancel={cancelClose}
      />
    </Modal>
  );
}
