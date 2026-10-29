"use client";

import { FormModal } from "./form-modal";
import { ValidatedFieldGroup } from "./validated-field-group";
import { CoordinateFields, GeocodeButton } from "./coordinate-fields";
import { SHOOTING_RANGE_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import type { FieldError } from "@/lib/server-error-mapper";
import { shootingRangeValidationConfig } from "@/lib/validation-schema";
import { EMPTY_SHOOTING_RANGE } from "@/types";
import type { NewShootingRange } from "@/types";

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
  const hasAddressForGeocode =
    (rangeData.street?.trim() || rangeData.city?.trim() || rangeData.name?.trim() || "").length >= 3;

  return (
    <FormModal<NewShootingRange>
      validationConfig={shootingRangeValidationConfig}
      formData={rangeData}
      setFormData={setRangeData}
      defaultData={EMPTY_SHOOTING_RANGE}
      initialData={initialRangeData}
      isOpen={isOpen}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      serverErrors={errors}
      fieldErrors={fieldErrors}
      fieldKeywords={SHOOTING_RANGE_FIELD_KEYWORDS}
      title={isEditing ? "Standort bearbeiten" : "Neuen Standort erstellen"}
      size="xl"
      submitLabel={isEditing ? "Aktualisieren" : "Erstellen"}
    >
      {({ getFieldError, handleChange, handleBlur, combinedErrors }) => {
        const geocodeBorderClass = geocodeSuccess
          ? "border-green-500 focus:border-green-500"
          : combinedErrors.latitude || combinedErrors.longitude
          ? "border-red-500 focus:border-red-500"
          : "";

        return (
          <>
            <ValidatedFieldGroup
              label="Name"
              name="name"
              id="modal-rangeName"
              type="text"
              value={rangeData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={(e) => handleBlur("name", e.target.value)}
              error={getFieldError("name")}
              required
              maxLength={100}
              placeholder="z. B. Standort Neubrandenburg"
              disabled={isSubmitting}
              autoFocus={!isEditing}
            />

            <ValidatedFieldGroup
              label="Straße"
              name="street"
              id="modal-rangeStreet"
              type="text"
              value={rangeData.street}
              onChange={(e) => handleChange("street", e.target.value)}
              onBlur={(e) => handleBlur("street", e.target.value)}
              error={getFieldError("street")}
              maxLength={200}
              placeholder="z. B. Musterstraße 1"
              disabled={isSubmitting}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ValidatedFieldGroup
                label="PLZ"
                name="postalCode"
                id="modal-rangePostalCode"
                type="text"
                value={rangeData.postalCode}
                onChange={(e) => handleChange("postalCode", e.target.value)}
                onBlur={(e) => handleBlur("postalCode", e.target.value)}
                error={getFieldError("postalCode")}
                maxLength={10}
                placeholder="z. B. 17033"
                disabled={isSubmitting}
              />
              <ValidatedFieldGroup
                label="Ort"
                name="city"
                id="modal-rangeCity"
                type="text"
                value={rangeData.city}
                onChange={(e) => handleChange("city", e.target.value)}
                onBlur={(e) => handleBlur("city", e.target.value)}
                error={getFieldError("city")}
                maxLength={100}
                placeholder="z. B. Neubrandenburg"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                <span className="form-label mb-0">Koordinaten *</span>
                <GeocodeButton
                  onClick={onGeocode}
                  disabled={!hasAddressForGeocode || isSubmitting || isGeocoding}
                  isGeocoding={isGeocoding}
                  className="sm:ml-auto"
                />
              </div>
              <CoordinateFields
                latitudeId="modal-rangeLatitude"
                longitudeId="modal-rangeLongitude"
                latitude={rangeData.latitude}
                longitude={rangeData.longitude}
                latitudePlaceholder="z. B. 53.5544"
                longitudePlaceholder="z. B. 13.2613"
                required
                disabled={isSubmitting || isGeocoding}
                geocodeSuccess={geocodeSuccess}
                borderClass={geocodeBorderClass}
                latitudeError={getFieldError("latitude") ? combinedErrors.latitude : undefined}
                longitudeError={getFieldError("longitude") ? combinedErrors.longitude : undefined}
                latitudeAriaInvalid={!!getFieldError("latitude")}
                longitudeAriaInvalid={!!getFieldError("longitude")}
                onChange={(field, value) => handleChange(field, value)}
                onBlur={(field, value) => handleBlur(field, value)}
              />
            </div>
          </>
        );
      }}
    </FormModal>
  );
}
