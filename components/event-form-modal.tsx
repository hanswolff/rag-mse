"use client";

import { useMemo } from "react";
import { Modal } from "./modal";
import { ConfirmCloseModal } from "./confirm-close-modal";
import { GermanDatePicker } from "./german-date-picker";
import { GermanTimePicker } from "./german-time-picker";
import { RichTextEditor } from "./rich-text-editor";
import { ShootingRangePicker, ShootingRange } from "./shooting-range-picker";
import { LoadingButton } from "./loading-button";
import { useFormModal } from "@/lib/use-form-modal";
import { useCrossFieldValidation } from "@/lib/useCrossFieldValidation";
import { EVENT_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import type { FieldError } from "@/lib/server-error-mapper";
import { eventValidationConfig, eventFormSchema } from "@/lib/validation-schema";
import { MAX_EVENT_DESCRIPTION_BYTES } from "@/lib/event-description";
import type { NewEvent } from "@/types";
import { AlertBox } from "./alert-box";

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
  fieldErrors?: FieldError[];
  initialEventData?: NewEvent;
  isGeocoding?: boolean;
  onGeocode?: () => void;
  geocodeSuccess?: boolean;
  onUseLastEvent?: () => void;
  isLoadingLastEvent?: boolean;
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
  fieldErrors,
  initialEventData,
  isGeocoding = false,
  onGeocode,
  geocodeSuccess = false,
  onUseLastEvent,
  isLoadingLastEvent = false,
}: EventFormModalProps) {
  const crossFieldErrors = useCrossFieldValidation(eventFormSchema, {
    date: eventData.date,
    timeFrom: eventData.timeFrom,
    timeTo: eventData.timeTo,
    location: eventData.location,
    description: eventData.description,
    latitude: eventData.latitude,
    longitude: eventData.longitude,
  });

  const timeRangeError = useMemo(() => {
    if (!eventData.timeFrom || !eventData.timeTo) return null;
    return crossFieldErrors.timeTo?.includes("nach") ? crossFieldErrors.timeTo : null;
  }, [crossFieldErrors, eventData.timeFrom, eventData.timeTo]);

  const {
    getFieldError,
    handleChange,
    handleBlur,
    handleClose,
    handleSubmit,
    generalErrors,
    combinedErrors,
    showCloseConfirm,
    handleConfirmClose,
    cancelClose,
    isValidAndTouched,
  } = useFormModal<NewEvent>({
    validationConfig: eventValidationConfig,
    formData: eventData,
    setFormData: setEventData,
    defaultData: initialNewEvent,
    initialData: initialEventData,
    isOpen,
    isSubmitting,
    onClose,
    onSubmit,
    serverErrors: errors,
    fieldErrors,
    fieldKeywords: EVENT_FIELD_KEYWORDS,
    extraValidation: () => !timeRangeError,
  });

  const handleDescriptionChange = (value: string) => {
    handleChange("description", value);
  };

  const handleDescriptionBlur = () => {
    handleBlur("description", eventData.description);
  };

  const handleGeocode = () => {
    if (onGeocode) onGeocode();
  };

  const handleUseLastEvent = () => {
    if (onUseLastEvent) onUseLastEvent();
  };

  const handleSelectRange = (range: ShootingRange, locationLabel: string) => {
    setEventData({
      ...eventData,
      location: locationLabel,
      latitude: range.latitude.toString(),
      longitude: range.longitude.toString(),
    });
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
        {Object.keys(generalErrors).length === 0 && (
          <AlertBox type="error" message={errors.general} />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            label="Datum"
            value={eventData.date}
            onChange={(date) => handleChange("date", date)}
            onBlur={() => handleBlur("date", eventData.date)}
            required
            disabled={isSubmitting}
            autoFocus={!isEditing}
            error={getFieldError("date")}
            showSuccess={isValidAndTouched("date", eventData.date)}
          />

          <GermanTimePicker
            id="timeFrom"
            label="Uhrzeit von"
            value={eventData.timeFrom}
            onChange={(time) => handleChange("timeFrom", time)}
            onBlur={() => handleBlur("timeFrom", eventData.timeFrom)}
            required
            disabled={isSubmitting}
            error={timeRangeError || getFieldError("timeFrom")}
            showSuccess={isValidAndTouched("timeFrom", eventData.timeFrom) && !timeRangeError}
          />
          <GermanTimePicker
            id="timeTo"
            label="Uhrzeit bis"
            value={eventData.timeTo}
            onChange={(time) => handleChange("timeTo", time)}
            onBlur={() => handleBlur("timeTo", eventData.timeTo)}
            required
            disabled={isSubmitting}
            error={timeRangeError || getFieldError("timeTo")}
            showSuccess={isValidAndTouched("timeTo", eventData.timeTo) && !timeRangeError}
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
                getFieldError("location") ? "border-red-500 focus:border-red-500" : ""
              }`}
              placeholder="z.B. Vereinsheim, Sportplatz..."
              disabled={isSubmitting || isGeocoding}
              aria-invalid={!!getFieldError("location")}
              aria-describedby={getFieldError("location") ? "location-error" : undefined}
            />
            <button
              type="button"
              onClick={handleGeocode}
              disabled={!eventData.location || eventData.location.trim().length < 3 || isSubmitting || isGeocoding}
              className="w-full sm:w-auto px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap touch-manipulation"
              title="Koordinaten automatisch suchen"
            >
              {isGeocoding ? "Suche..." : "📍 Koordinaten suchen"}
            </button>
            <ShootingRangePicker
              disabled={isSubmitting || isGeocoding}
              onSelect={handleSelectRange}
            />
          </div>
          {getFieldError("location") && (
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
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="modal-description" className="form-label mb-0">
              Beschreibung *
            </label>
            {!isEditing && onUseLastEvent && (
              <button
                type="button"
                onClick={handleUseLastEvent}
                disabled={isSubmitting || isLoadingLastEvent}
                className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingLastEvent
                  ? "Lade..."
                  : "Daten vom letzten Termin übernehmen"}
              </button>
            )}
          </div>
          <RichTextEditor
            id="modal-description"
            value={eventData.description}
            onChange={handleDescriptionChange}
            onBlur={handleDescriptionBlur}
            disabled={isSubmitting}
            error={getFieldError("description")}
            maxBytes={MAX_EVENT_DESCRIPTION_BYTES}
          />
          {getFieldError("description") && (
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
