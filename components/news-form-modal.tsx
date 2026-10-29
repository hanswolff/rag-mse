"use client";

import { FormModal } from "./form-modal";
import { GermanDatePicker } from "./german-date-picker";
import { ValidatedFieldGroup } from "./validated-field-group";
import { NEWS_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import type { FieldError } from "@/lib/server-error-mapper";
import { newsValidationConfig } from "@/lib/validation-schema";
import { EMPTY_NEWS_FORM } from "@/lib/news-form-defaults";
import type { NewNews } from "@/types";

export type { NewNews };

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
  return (
    <FormModal<NewNews>
      validationConfig={newsValidationConfig}
      formData={newsData}
      setFormData={setNewsData}
      defaultData={EMPTY_NEWS_FORM}
      initialData={initialNewsData}
      isOpen={isOpen}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      serverErrors={errors}
      fieldErrors={fieldErrors}
      fieldKeywords={NEWS_FIELD_KEYWORDS}
      title={isEditing ? "News bearbeiten" : "Neue News erstellen"}
      size="lg"
      submitLabel={isEditing ? "Aktualisieren" : "Erstellen"}
    >
      {({ getFieldError, handleChange, handleBlur, isValidAndTouched }) => (
        <>
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
            placeholder="Inhalt der News…"
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
        </>
      )}
    </FormModal>
  );
}
