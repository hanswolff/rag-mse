"use client";

import { useMemo } from "react";
import { Modal } from "./modal";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { userValidationConfig } from "@/lib/validation-schema";

type UserRole = "ADMIN" | "MEMBER";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  userData: {
    email: string;
    name: string;
    address: string;
    phone: string;
    role: UserRole;
  };
  setUserData: (data: { email: string; name: string; address: string; phone: string; role: UserRole }) => void;
  isEditing: boolean;
  errors?: Record<string, string>;
  initialUserData?: {
    email: string;
    name: string;
    address: string;
    phone: string;
    role: UserRole;
  };
}

const initialNewUser = {
  email: "",
  name: "",
  address: "",
  phone: "",
  role: "MEMBER" as UserRole,
};

export function UserFormModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  userData,
  setUserData,
  isEditing,
  errors = {},
  initialUserData,
}: UserFormModalProps) {
  const { errors: validationErrors, validateField, markFieldAsTouched, isFieldValid } = useFormFieldValidation(userValidationConfig);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const base = initialUserData || initialNewUser;
    return (
      userData.email !== base.email ||
      userData.name !== base.name ||
      userData.address !== base.address ||
      userData.phone !== base.phone ||
      userData.role !== base.role
    );
  }, [userData, initialUserData]);

  // Combine server errors with local validation errors
  const combinedErrors = useMemo(() => {
    return { ...validationErrors, ...errors };
  }, [validationErrors, errors]);

  const handleChange = (name: string, value: string) => {
    setUserData({ ...userData, [name]: value });

    if (validationErrors[name]) {
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
      email: userData.email,
      name: userData.name,
      address: userData.address,
      phone: userData.phone,
    };

    // Mark all fields as touched when submitting to show validation errors
    markFieldAsTouched("email");
    markFieldAsTouched("name");
    markFieldAsTouched("address");
    markFieldAsTouched("phone");

    validateField("email", values.email);
    validateField("name", values.name);
    validateField("address", values.address);
    validateField("phone", values.phone);

    const isValid =
      isFieldValid("email", values.email) &&
      isFieldValid("name", values.name) &&
      isFieldValid("address", values.address) &&
      isFieldValid("phone", values.phone);

    if (!isValid) {
      return;
    }

    onSubmit(e);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "Benutzer bearbeiten" : "Benutzer erstellen"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="modal-email" className="form-label">
            E-Mail *
          </label>
          <input
            id="modal-email"
            type="email"
            value={userData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            onBlur={(e) => handleBlur("email", e.target.value)}
            required
            className={`form-input ${
              shouldShowFieldError("email") ? "border-red-500 focus:border-red-500" : ""
            }`}
            placeholder="beispiel@email.de"
            disabled={isSubmitting}
            autoFocus={!isEditing}
            aria-invalid={!!shouldShowFieldError("email")}
            aria-describedby={shouldShowFieldError("email") ? "email-error" : undefined}
          />
          {shouldShowFieldError("email") && (
            <p id="email-error" className="form-help text-red-600">
              {combinedErrors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="modal-name" className="form-label">
            Name *
          </label>
          <input
            id="modal-name"
            type="text"
            value={userData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            onBlur={(e) => handleBlur("name", e.target.value)}
            required
            maxLength={100}
            className={`form-input ${
              shouldShowFieldError("name") ? "border-red-500 focus:border-red-500" : ""
            }`}
            placeholder="Max Mustermann"
            disabled={isSubmitting}
            autoFocus={isEditing}
            aria-invalid={!!shouldShowFieldError("name")}
            aria-describedby={shouldShowFieldError("name") ? "name-error" : undefined}
          />
          {shouldShowFieldError("name") && (
            <p id="name-error" className="form-help text-red-600">
              {combinedErrors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="modal-address" className="form-label">
            Adresse
          </label>
          <input
            id="modal-address"
            type="text"
            value={userData.address}
            onChange={(e) => handleChange("address", e.target.value)}
            onBlur={(e) => handleBlur("address", e.target.value)}
            maxLength={200}
            className={`form-input ${
              shouldShowFieldError("address") ? "border-red-500 focus:border-red-500" : ""
            }`}
            placeholder="Musterstraße 1, 12345 Musterstadt"
            disabled={isSubmitting}
            aria-invalid={!!shouldShowFieldError("address")}
            aria-describedby={shouldShowFieldError("address") ? "address-error" : undefined}
          />
          {shouldShowFieldError("address") && (
            <p id="address-error" className="form-help text-red-600">
              {combinedErrors.address}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="modal-phone" className="form-label">
            Telefon
          </label>
          <input
            id="modal-phone"
            type="tel"
            value={userData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            onBlur={(e) => handleBlur("phone", e.target.value)}
            maxLength={30}
            className={`form-input ${
              shouldShowFieldError("phone") ? "border-red-500 focus:border-red-500" : ""
            }`}
            placeholder="0123 456789"
            disabled={isSubmitting}
            aria-invalid={!!shouldShowFieldError("phone")}
            aria-describedby={shouldShowFieldError("phone") ? "phone-error" : undefined}
          />
          {shouldShowFieldError("phone") && (
            <p id="phone-error" className="form-help text-red-600">
              {combinedErrors.phone}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="modal-role" className="form-label">
            Rolle *
          </label>
          <select
            id="modal-role"
            value={userData.role}
            onChange={(e) => handleChange("role", e.target.value as UserRole)}
            required
            className="form-input"
            disabled={isSubmitting}
          >
            <option value="MEMBER">Mitglied</option>
            <option value="ADMIN">Administrator</option>
          </select>
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
