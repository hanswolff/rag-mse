"use client";

import { Modal } from "./modal";
import { ConfirmCloseModal } from "./confirm-close-modal";
import { LoadingButton } from "./loading-button";
import { useFormModal } from "@/lib/use-form-modal";
import { SHOOTING_RANGE_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import type { FieldError } from "@/lib/server-error-mapper";
import { shootingRangeValidationConfig } from "@/lib/validation-schema";
import { EMPTY_SHOOTING_RANGE } from "@/types";
import type { NewShootingRange } from "@/types";
import { AlertBox } from "./alert-box";

interface RangeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  rangeData: NewShootingRange;
  setRangeData: (data: NewShootingRange) => void;
  isEditing: boolean;
  errors?: Record<string, string>;
  fieldErrors?: FieldError[];
  initialRangeData?: NewShootingRange;
  isGeocoding?: boolean;
  onGeocode?: () => void;
  geocodeSuccess?: boolean;
}

export function RangeFormModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  rangeData,
  setRangeData,
  isEditing,
  errors = {},
  fieldErrors,
  initialRangeData,
  isGeocoding = false,
  onGeocode,
  geocodeSuccess = false,
}: RangeFormModalProps) {
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
  } = useFormModal<NewShootingRange>({
    validationConfig: shootingRangeValidationConfig,
    formData: rangeData,
    setFormData: setRangeData,
    defaultData: EMPTY_SHOOTING_RANGE,
    initialData: initialRangeData,
    isOpen,
    isSubmitting,
    onClose,
    onSubmit,
    serverErrors: errors,
    fieldErrors,
    fieldKeywords: SHOOTING_RANGE_FIELD_KEYWORDS,
  });

  const geocodeBorderClass = geocodeSuccess
    ? "border-green-500 focus:border-green-500"
    : combinedErrors.latitude || combinedErrors.longitude
    ? "border-red-500 focus:border-red-500"
    : "";

  const hasAddressForGeocode =
    (rangeData.street?.trim() || rangeData.city?.trim() || rangeData.name?.trim() || "").length >= 3;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "Standort bearbeiten" : "Neuen Standort erstellen"}
      size="xl"
      closeOnOutsideClick={false}
      closeOnEscape={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {Object.keys(generalErrors).length === 0 && (
          <AlertBox type="error" message={errors.general} />
        )}

        <div>
          <label htmlFor="modal-rangeName" className="form-label">
            Name *
          </label>
          <input
            id="modal-rangeName"
            type="text"
            value={rangeData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            onBlur={(e) => handleBlur("name", e.target.value)}
            required
            maxLength={100}
            className={`form-input ${getFieldError("name") ? "border-red-500 focus:border-red-500" : ""}`}
            placeholder="z.B. Schießstand Neubrandenburg"
            disabled={isSubmitting}
            autoFocus={!isEditing}
            aria-invalid={!!getFieldError("name")}
            aria-describedby={getFieldError("name") ? "name-error" : undefined}
          />
          {getFieldError("name") && (
            <p id="name-error" className="form-help text-red-600">{combinedErrors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="modal-rangeStreet" className="form-label">
            Straße
          </label>
          <input
            id="modal-rangeStreet"
            type="text"
            value={rangeData.street}
            onChange={(e) => handleChange("street", e.target.value)}
            onBlur={(e) => handleBlur("street", e.target.value)}
            maxLength={200}
            className={`form-input ${getFieldError("street") ? "border-red-500 focus:border-red-500" : ""}`}
            placeholder="z.B. Musterstraße 1"
            disabled={isSubmitting}
          />
          {getFieldError("street") && (
            <p className="form-help text-red-600">{combinedErrors.street}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="modal-rangePostalCode" className="form-label">
              PLZ
            </label>
            <input
              id="modal-rangePostalCode"
              type="text"
              value={rangeData.postalCode}
              onChange={(e) => handleChange("postalCode", e.target.value)}
              onBlur={(e) => handleBlur("postalCode", e.target.value)}
              maxLength={10}
              className={`form-input ${getFieldError("postalCode") ? "border-red-500 focus:border-red-500" : ""}`}
              placeholder="z.B. 17033"
              disabled={isSubmitting}
            />
            {getFieldError("postalCode") && (
              <p className="form-help text-red-600">{combinedErrors.postalCode}</p>
            )}
          </div>
          <div>
            <label htmlFor="modal-rangeCity" className="form-label">
              Ort
            </label>
            <input
              id="modal-rangeCity"
              type="text"
              value={rangeData.city}
              onChange={(e) => handleChange("city", e.target.value)}
              onBlur={(e) => handleBlur("city", e.target.value)}
              maxLength={100}
              className={`form-input ${getFieldError("city") ? "border-red-500 focus:border-red-500" : ""}`}
              placeholder="z.B. Neubrandenburg"
              disabled={isSubmitting}
            />
            {getFieldError("city") && (
              <p className="form-help text-red-600">{combinedErrors.city}</p>
            )}
          </div>
        </div>

        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
            <span className="form-label mb-0">Koordinaten *</span>
            <button
              type="button"
              onClick={onGeocode}
              disabled={!hasAddressForGeocode || isSubmitting || isGeocoding}
              className="w-full sm:w-auto sm:ml-auto px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap touch-manipulation"
              title="Koordinaten automatisch suchen"
            >
              {isGeocoding ? "Suche..." : "📍 Koordinaten suchen"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-rangeLatitude" className="form-label">
                Breitengrad *
              </label>
              <input
                id="modal-rangeLatitude"
                type="text"
                value={rangeData.latitude}
                onChange={(e) => handleChange("latitude", e.target.value)}
                onBlur={(e) => handleBlur("latitude", e.target.value)}
                required
                className={`form-input ${geocodeBorderClass} ${getFieldError("latitude") ? "border-red-500 focus:border-red-500" : ""}`}
                placeholder="z.B. 53.5544"
                disabled={isSubmitting || isGeocoding}
                aria-invalid={!!getFieldError("latitude")}
              />
              {geocodeSuccess && (
                <p className="form-help text-green-600 text-sm">Koordinaten automatisch gefunden</p>
              )}
              {getFieldError("latitude") && !geocodeSuccess && (
                <p className="form-help text-red-600">{combinedErrors.latitude}</p>
              )}
            </div>
            <div>
              <label htmlFor="modal-rangeLongitude" className="form-label">
                Längengrad *
              </label>
              <input
                id="modal-rangeLongitude"
                type="text"
                value={rangeData.longitude}
                onChange={(e) => handleChange("longitude", e.target.value)}
                onBlur={(e) => handleBlur("longitude", e.target.value)}
                required
                className={`form-input ${geocodeBorderClass} ${getFieldError("longitude") ? "border-red-500 focus:border-red-500" : ""}`}
                placeholder="z.B. 13.2613"
                disabled={isSubmitting || isGeocoding}
                aria-invalid={!!getFieldError("longitude")}
              />
              {geocodeSuccess && (
                <p className="form-help text-green-600 text-sm">Koordinaten automatisch gefunden</p>
              )}
              {getFieldError("longitude") && !geocodeSuccess && (
                <p className="form-help text-red-600">{combinedErrors.longitude}</p>
              )}
            </div>
          </div>
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
            {isEditing ? "Aktualisieren" : "Erstellen"}
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
