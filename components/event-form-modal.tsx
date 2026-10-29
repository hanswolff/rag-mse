"use client";

import { useMemo } from "react";
import { FormModal } from "./form-modal";
import { GermanDatePicker } from "./german-date-picker";
import { GermanTimePicker } from "./german-time-picker";
import { RichTextEditor } from "./rich-text-editor";
import { ShootingRangePicker, ShootingRange } from "./shooting-range-picker";
import { ValidatedFieldGroup } from "./validated-field-group";
import { CoordinateFields, GeocodeButton } from "./coordinate-fields";
import { VisibilitySelect } from "./visibility-select";
import { AlertBox } from "./alert-box";
import { useCollisionHint } from "@/lib/use-collision-hint";
import { useCrossFieldValidation } from "@/lib/use-cross-field-validation";
import { EVENT_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import type { FieldError } from "@/lib/server-error-mapper";
import {
  eventValidationConfig,
  eventFormSchema,
  MAX_EVENT_TITLE_LENGTH,
  MAX_EVENT_COST_LENGTH,
} from "@/lib/validation-schema";
import { MAX_EVENT_DESCRIPTION_BYTES } from "@/lib/event-description";
import { EVENT_TYPE_OPTIONS } from "@/lib/event-types";
import { EMPTY_EVENT_FORM } from "@/lib/event-form-defaults";
import type { NewEvent } from "@/types";

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  eventData: NewEvent;
  setEventData: (data: NewEvent) => void;
  isEditing: boolean;
  eventId?: string;
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
  eventId,
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

  const collisionHint = useCollisionHint(eventData.date, eventId, isOpen);

  const timeRangeError = useMemo(() => {
    if (!eventData.timeFrom || !eventData.timeTo) return null;
    return crossFieldErrors.timeTo?.includes("nach") ? crossFieldErrors.timeTo : null;
  }, [crossFieldErrors, eventData.timeFrom, eventData.timeTo]);

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

  return (
    <FormModal<NewEvent>
      validationConfig={eventValidationConfig}
      formData={eventData}
      setFormData={setEventData}
      defaultData={EMPTY_EVENT_FORM}
      initialData={initialEventData}
      isOpen={isOpen}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      serverErrors={errors}
      fieldErrors={fieldErrors}
      fieldKeywords={EVENT_FIELD_KEYWORDS}
      extraValidation={() => !timeRangeError}
      title={isEditing ? "Termin bearbeiten" : "Neuen Termin erstellen"}
      size="2xl"
      submitLabel={isEditing ? "Aktualisieren" : "Erstellen"}
    >
      {({ getFieldError, handleChange, handleBlur, isValidAndTouched, combinedErrors }) => {
        const geocodeBorderClass = geocodeSuccess
          ? "border-green-500 focus:border-green-500"
          : combinedErrors.latitude || combinedErrors.longitude
          ? "border-red-500 focus:border-red-500"
          : "";

        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="modal-eventType" className="form-label">
                  Terminart
                </label>
                <select
                  id="modal-eventType"
                  value={eventData.type}
                  onChange={(e) => handleChange("type", e.target.value)}
                  className="form-select"
                  disabled={isSubmitting}
                >
                  {EVENT_TYPE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
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

            <AlertBox type="warning" message={collisionHint} persistent />

            <ValidatedFieldGroup
              label="Titel"
              name="title"
              id="modal-title"
              type="text"
              value={eventData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              onBlur={(e) => handleBlur("title", e.target.value)}
              error={getFieldError("title")}
              maxLength={MAX_EVENT_TITLE_LENGTH}
              placeholder="z. B. Dynamisches Pistolenschießen Level 1"
              disabled={isSubmitting}
            />

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
                  placeholder="z. B. Vereinsheim, Sportplatz…"
                  disabled={isSubmitting || isGeocoding}
                  aria-invalid={!!getFieldError("location")}
                  aria-describedby={getFieldError("location") ? "location-error" : undefined}
                />
                <GeocodeButton
                  onClick={handleGeocode}
                  disabled={!eventData.location || eventData.location.trim().length < 3 || isSubmitting || isGeocoding}
                  isGeocoding={isGeocoding}
                />
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
              <ValidatedFieldGroup
                label="Kosten"
                name="cost"
                id="modal-cost"
                type="text"
                value={eventData.cost}
                onChange={(e) => handleChange("cost", e.target.value)}
                onBlur={(e) => handleBlur("cost", e.target.value)}
                error={getFieldError("cost")}
                maxLength={MAX_EVENT_COST_LENGTH}
                placeholder="z. B. 25 € für Mitglieder, 40 € für Gäste"
                disabled={isSubmitting}
              />
              <ValidatedFieldGroup
                label="Plätze"
                name="capacity"
                id="modal-capacity"
                type="text"
                inputMode="numeric"
                value={eventData.capacity}
                onChange={(e) => handleChange("capacity", e.target.value)}
                onBlur={(e) => handleBlur("capacity", e.target.value)}
                error={getFieldError("capacity")}
                placeholder="z. B. 12"
                disabled={isSubmitting}
              />
            </div>

            <CoordinateFields
              latitudeId="modal-latitude"
              longitudeId="modal-longitude"
              latitude={eventData.latitude}
              longitude={eventData.longitude}
              latitudePlaceholder="z. B. 52.5200"
              longitudePlaceholder="z. B. 13.4050"
              disabled={isSubmitting || isGeocoding}
              geocodeSuccess={geocodeSuccess}
              borderClass={geocodeBorderClass}
              latitudeError={combinedErrors.latitude}
              longitudeError={combinedErrors.longitude}
              latitudeAriaInvalid={!!combinedErrors.latitude}
              longitudeAriaInvalid={!!combinedErrors.longitude}
              onChange={(field, value) => handleChange(field, value)}
            />

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label id="modal-description-label" className="form-label mb-0">
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
                      ? "Lade…"
                      : "Daten vom letzten Termin übernehmen"}
                  </button>
                )}
              </div>
              <RichTextEditor
                labelId="modal-description-label"
                errorId="description-error"
                value={eventData.description}
                onChange={(value) => handleChange("description", value)}
                onBlur={() => handleBlur("description", eventData.description)}
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

            <VisibilitySelect
              id="modal-visibility"
              value={eventData.visibility}
              onChange={(visibility) => handleChange("visibility", visibility)}
              disabled={isSubmitting}
              help="Termine „Nur für Mitglieder“ sehen nur eingeloggte Benutzer, verborgene nur der Adminbereich."
            />
          </>
        );
      }}
    </FormModal>
  );
}
