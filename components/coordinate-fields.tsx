"use client";

/** Geocode-Button, wie er im Termin- und Standort-Formular identisch vorkam. */
export function GeocodeButton({
  onClick,
  disabled,
  isGeocoding,
  className = "",
}: {
  onClick?: () => void;
  disabled: boolean;
  isGeocoding: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full sm:w-auto ${className ? `${className} ` : ""}px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap touch-manipulation`}
      title="Koordinaten automatisch suchen"
    >
      {isGeocoding ? "Suche…" : "📍 Koordinaten suchen"}
    </button>
  );
}

interface CoordinateFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  required?: boolean;
  disabled: boolean;
  borderClass: string;
  geocodeSuccess: boolean;
  error?: string;
  ariaInvalid: boolean;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
}

function CoordinateField({
  id,
  label,
  value,
  placeholder,
  required = false,
  disabled,
  borderClass,
  geocodeSuccess,
  error,
  ariaInvalid,
  onChange,
  onBlur,
}: CoordinateFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
        {required && " *"}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...(onBlur && { onBlur: (e: React.FocusEvent<HTMLInputElement>) => onBlur(e.target.value) })}
        {...(required && { required: true })}
        className={`form-input ${borderClass}${error ? " border-red-500 focus:border-red-500" : ""}`}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={ariaInvalid}
      />
      {geocodeSuccess && (
        <p className="form-help text-green-600 text-sm">Koordinaten automatisch gefunden</p>
      )}
      {error && !geocodeSuccess && (
        <p className="form-help text-red-600">{error}</p>
      )}
    </div>
  );
}

export interface CoordinateFieldsProps {
  latitudeId: string;
  longitudeId: string;
  latitude: string;
  longitude: string;
  latitudePlaceholder: string;
  longitudePlaceholder: string;
  required?: boolean;
  disabled: boolean;
  geocodeSuccess: boolean;
  borderClass: string;
  latitudeError?: string;
  longitudeError?: string;
  latitudeAriaInvalid: boolean;
  longitudeAriaInvalid: boolean;
  onChange: (field: "latitude" | "longitude", value: string) => void;
  onBlur?: (field: "latitude" | "longitude", value: string) => void;
}

/**
 * Breitengrad/Längengrad-Feldpaar mit Geocode-Hinweisen, wie es im Termin-
 * und Standort-Formular doppelt gepflegt wurde.
 */
export function CoordinateFields({
  latitudeId,
  longitudeId,
  latitude,
  longitude,
  latitudePlaceholder,
  longitudePlaceholder,
  required = false,
  disabled,
  geocodeSuccess,
  borderClass,
  latitudeError,
  longitudeError,
  latitudeAriaInvalid,
  longitudeAriaInvalid,
  onChange,
  onBlur,
}: CoordinateFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <CoordinateField
        id={latitudeId}
        label="Breitengrad"
        value={latitude}
        placeholder={latitudePlaceholder}
        required={required}
        disabled={disabled}
        borderClass={borderClass}
        geocodeSuccess={geocodeSuccess}
        error={latitudeError}
        ariaInvalid={latitudeAriaInvalid}
        onChange={(value) => onChange("latitude", value)}
        onBlur={onBlur && ((value) => onBlur("latitude", value))}
      />
      <CoordinateField
        id={longitudeId}
        label="Längengrad"
        value={longitude}
        placeholder={longitudePlaceholder}
        required={required}
        disabled={disabled}
        borderClass={borderClass}
        geocodeSuccess={geocodeSuccess}
        error={longitudeError}
        ariaInvalid={longitudeAriaInvalid}
        onChange={(value) => onChange("longitude", value)}
        onBlur={onBlur && ((value) => onBlur("longitude", value))}
      />
    </div>
  );
}
