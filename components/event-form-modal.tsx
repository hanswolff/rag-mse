"use client";

import { useMemo } from "react";
import { Modal } from "./modal";
import { GermanDatePicker } from "./german-date-picker";
import { GermanTimePicker } from "./german-time-picker";
import { RichTextEditor } from "./rich-text-editor";
import { ShootingRangePicker, ShootingRange } from "./shooting-range-picker";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { eventValidationConfig } from "@/lib/validation-schema";
import { MAX_EVENT_DESCRIPTION_BYTES } from "@/lib/event-description";
import type { NewEvent } from "@/types";

const initialNewEvent: NewEvent = {
  date: "",
  timeFrom: "",
  timeTo: "",
  location: "",
  description: "",
  latitude: "",
  longitude: "",
  type: "",
  visible: true,
};

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  eventData: NewEvent;
  setEventData: (data: NewEvent) => void;
  isEditing: boolean;
  errors?: Record<string, string>;
  initialEventData?: NewEvent;
  isGeocoding?: boolean;
  onGeocode?: () => void;
  geocodeSuccess?: boolean;
}

export function EventFormModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  eventData,
  setEventData,
  isEditing,
  errors = {},
  initialEventData,
  isGeocoding = false,
  onGeocode,
  geocodeSuccess = false,
}: EventFormModalProps) {
  const { errors: validationErrors, validateField, markFieldAsTouched, isFieldValid } = useFormFieldValidation(eventValidationConfig);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const base = initialEventData || initialNewEvent;
    return (
      eventData.date !== base.date ||
      eventData.timeFrom !== base.timeFrom ||
      eventData.timeTo !== base.timeTo ||
      eventData.location !== base.location ||
      eventData.description !== base.description ||
      eventData.latitude !== base.latitude ||
      eventData.longitude !== base.longitude ||
      eventData.type !== base.type ||
      eventData.visible !== base.visible
    );
  }, [eventData, initialEventData]);

  // Cross-field validation: timeFrom must be before timeTo
  const timeRangeError = useMemo(() => {
    if (eventData.timeFrom && eventData.timeTo) {
      const [hoursFrom, minutesFrom] = eventData.timeFrom.split(":").map(Number);
      const [hoursTo, minutesTo] = eventData.timeTo.split(":").map(Number);
      const fromMinutes = hoursFrom * 60 + minutesFrom;
      const toMinutes = hoursTo * 60 + minutesTo;

      if (fromMinutes >= toMinutes) {
        return "Uhrzeit bis muss nach Uhrzeit von liegen";
      }
    }
    return null;
  }, [eventData.timeFrom, eventData.timeTo]);

  // Combine server errors with local validation errors
  const combinedErrors = useMemo(() => {
    return { ...validationErrors, ...errors };
  }, [validationErrors, errors]);

  const handleChange = (name: string, value: string | boolean) => {
    setEventData({ ...eventData, [name]: value });

    if (typeof value === "string" && validationErrors[name]) {
      validateField(name, value);
    }
  };

  const handleBlur = (name: string, value: string) => {
    markFieldAsTouched(name);
    validateField(name, value);
  };

  const handleDescriptionChange = (value: string) => {
    handleChange("description", value);
  };

  const handleDescriptionBlur = () => {
    handleBlur("description", eventData.description);
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

  const handleGeocode = () => {
    if (onGeocode) onGeocode();
  };

  const handleSelectRange = (range: ShootingRange, locationLabel: string) => {
    setEventData({
      ...eventData,
      location: locationLabel,
      latitude: range.latitude.toString(),
      longitude: range.longitude.toString(),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const values = {
      date: eventData.date,
      timeFrom: eventData.timeFrom,
      timeTo: eventData.timeTo,
      location: eventData.location,
      description: eventData.description,
    };

    // Mark all fields as touched when submitting to show validation errors
    markFieldAsTouched("date");
    markFieldAsTouched("timeFrom");
    markFieldAsTouched("timeTo");
    markFieldAsTouched("location");
    markFieldAsTouched("description");

    validateField("date", values.date);
    validateField("timeFrom", values.timeFrom);
    validateField("timeTo", values.timeTo);
    validateField("location", values.location);
    validateField("description", values.description);

    const isValid =
      isFieldValid("date", values.date) &&
      isFieldValid("timeFrom", values.timeFrom) &&
      isFieldValid("timeTo", values.timeTo) &&
      isFieldValid("location", values.location) &&
      isFieldValid("description", values.description) &&
      !timeRangeError;

    if (!isValid) {
      return;
    }

    onSubmit(e);
  };

  const geocodeBorderClass = geocodeSuccess
    ? "border-green-500 focus:border-green-500"
    : combinedErrors.latitude || combinedErrors.longitude
    ? "border-red-500 focus:border-red-500"
    : "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "Termin bearbeiten" : "Neuen Termin erstellen"}
      size="2xl"
      closeOnOutsideClick={false}
      closeOnEscape={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errors.general && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {errors.general}
          </div>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="modal-eventType" className="form-label">
              Typ
            </label>
            <select
              id="modal-eventType"
              value={eventData.type}
              onChange={(e) => handleChange("type", e.target.value)}
              className="form-input"
              disabled={isSubmitting}
            >
              <option value="">Kein Typ</option>
              <option value="Training">Training</option>
              <option value="Wettkampf">Wettkampf</option>
            </select>
          </div>

          <GermanDatePicker
            id="eventDate"
            label="Datum *"
            value={eventData.date}
            onChange={(date) => handleChange("date", date)}
            required
            disabled={isSubmitting}
            autoFocus={!isEditing}
            error={shouldShowFieldError("date")}
          />

          <GermanTimePicker
            id="timeFrom"
            label="Uhrzeit von *"
            value={eventData.timeFrom}
            onChange={(time) => handleChange("timeFrom", time)}
            required
            disabled={isSubmitting}
            error={timeRangeError || shouldShowFieldError("timeFrom")}
          />
          <GermanTimePicker
            id="timeTo"
            label="Uhrzeit bis *"
            value={eventData.timeTo}
            onChange={(time) => handleChange("timeTo", time)}
            required
            disabled={isSubmitting}
            error={timeRangeError || shouldShowFieldError("timeTo")}
          />
        </div>

        <div>
          <label htmlFor="modal-location" className="form-label">
            Ort *
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="modal-location"
              type="text"
              value={eventData.location}
              onChange={(e) => handleChange("location", e.target.value)}
              onBlur={(e) => handleBlur("location", e.target.value)}
              required
              maxLength={200}
              className={`flex-1 form-input ${
                shouldShowFieldError("location") ? "border-red-500 focus:border-red-500" : ""
              }`}
              placeholder="z.B. Vereinsheim, Sportplatz..."
              disabled={isSubmitting || isGeocoding}
              aria-invalid={!!shouldShowFieldError("location")}
              aria-describedby={shouldShowFieldError("location") ? "location-error" : undefined}
            />
            <button
              type="button"
              onClick={handleGeocode}
              disabled={!eventData.location || eventData.location.trim().length < 3 || isSubmitting || isGeocoding}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-base sm:text-base touch-manipulation"
              title="Koordinaten automatisch suchen"
            >
              {isGeocoding ? "Suche..." : "📍 Koordinaten suchen"}
            </button>
            <ShootingRangePicker
              disabled={isSubmitting || isGeocoding}
              onSelect={handleSelectRange}
            />
          </div>
          {shouldShowFieldError("location") && (
            <p id="location-error" className="form-help text-red-600">
              {combinedErrors.location}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="modal-latitude" className="form-label">
              Breitengrad
            </label>
            <input
              id="modal-latitude"
              type="text"
              value={eventData.latitude}
              onChange={(e) => handleChange("latitude", e.target.value)}
              className={`form-input ${geocodeBorderClass}`}
              placeholder="z.B. 52.5200"
              disabled={isSubmitting || isGeocoding}
              aria-invalid={!!combinedErrors.latitude}
            />
            {geocodeSuccess && (
              <p className="form-help text-green-600 text-sm">
                Koordinaten automatisch gefunden
              </p>
            )}
          </div>
          <div>
            <label htmlFor="modal-longitude" className="form-label">
              Längengrad
            </label>
            <input
              id="modal-longitude"
              type="text"
              value={eventData.longitude}
              onChange={(e) => handleChange("longitude", e.target.value)}
              className={`form-input ${geocodeBorderClass}`}
              placeholder="z.B. 13.4050"
              disabled={isSubmitting || isGeocoding}
              aria-invalid={!!combinedErrors.longitude}
            />
            {geocodeSuccess && (
              <p className="form-help text-green-600 text-sm">
                Koordinaten automatisch gefunden
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="modal-description" className="form-label">
            Beschreibung *
          </label>
          <RichTextEditor
            id="modal-description"
            value={eventData.description}
            onChange={handleDescriptionChange}
            onBlur={handleDescriptionBlur}
            disabled={isSubmitting}
            error={shouldShowFieldError("description")}
            maxBytes={MAX_EVENT_DESCRIPTION_BYTES}
          />
          {shouldShowFieldError("description") && (
            <p id="description-error" className="form-help text-red-600">
              {combinedErrors.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            id="modal-eventVisible"
            type="checkbox"
            checked={eventData.visible}
            onChange={(e) => handleChange("visible", e.target.checked)}
            className="h-4 w-4 text-brand-red-600 border-gray-300 rounded focus:ring-brand-red-600"
            disabled={isSubmitting}
          />
          <label htmlFor="modal-eventVisible" className="text-base text-gray-700">
            Termin sichtbar
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
