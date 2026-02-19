"use client";

import { useEffect, useMemo } from "react";
import { Modal } from "./modal";
import { LoadingButton } from "./loading-button";
import { GermanDatePicker } from "./german-date-picker";
import { ValidatedFieldGroup } from "./validated-field-group";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { mapServerErrorToField, PROFILE_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { adminUserValidationConfig } from "@/lib/validation-schema";

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
    memberSince: string;
    dateOfBirth: string;
    rank: string;
    pk: string;
    reservistsAssociation: string;
    associationMemberNumber: string;
    hasPossessionCard: boolean;
    adminNotes: string;
  };
  setUserData: (data: { email: string; name: string; address: string; phone: string; role: UserRole; memberSince: string; dateOfBirth: string; rank: string; pk: string; reservistsAssociation: string; associationMemberNumber: string; hasPossessionCard: boolean; adminNotes: string }) => void;
  isEditing: boolean;
  errors?: Record<string, string>;
  initialUserData?: {
    email: string;
    name: string;
    address: string;
    phone: string;
    role: UserRole;
    memberSince: string;
    dateOfBirth: string;
    rank: string;
    pk: string;
    reservistsAssociation: string;
    associationMemberNumber: string;
    hasPossessionCard: boolean;
    adminNotes: string;
  };
}

const initialNewUser = {
  email: "",
  name: "",
  address: "",
  phone: "",
  role: "MEMBER" as UserRole,
  memberSince: "",
  dateOfBirth: "",
  rank: "",
  pk: "",
  reservistsAssociation: "",
  associationMemberNumber: "",
  hasPossessionCard: false,
  adminNotes: "",
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
  const {
    errors: validationErrors,
    validateField,
    validateAllFields,
    markFieldAsTouched,
    shouldShowError,
    isValidAndTouched,
    reset,
  } = useFormFieldValidation(adminUserValidationConfig);

  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const inferredGeneralErrors = useMemo(() => {
    return mapServerErrorToField(errors.general || "", PROFILE_FIELD_KEYWORDS);
  }, [errors.general]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const base = initialUserData || initialNewUser;
    return (
      userData.email !== base.email ||
      userData.name !== base.name ||
      userData.address !== base.address ||
      userData.phone !== base.phone ||
      userData.role !== base.role ||
      userData.memberSince !== base.memberSince ||
      userData.dateOfBirth !== base.dateOfBirth ||
      userData.rank !== base.rank ||
      userData.pk !== base.pk ||
      userData.reservistsAssociation !== base.reservistsAssociation ||
      userData.associationMemberNumber !== base.associationMemberNumber ||
      userData.hasPossessionCard !== base.hasPossessionCard ||
      userData.adminNotes !== base.adminNotes
    );
  }, [userData, initialUserData]);

  // Combine server errors with local validation errors
  const combinedErrors = useMemo(() => {
    return { ...validationErrors, ...inferredGeneralErrors, ...errors };
  }, [validationErrors, inferredGeneralErrors, errors]);

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

  const getFieldError = (fieldName: string): string | undefined => {
    if (errors[fieldName]) return errors[fieldName];
    if (combinedErrors[fieldName] && shouldShowError(fieldName, userData[fieldName as keyof typeof userData] as string)) {
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
      email: userData.email,
      name: userData.name,
      address: userData.address,
      phone: userData.phone,
      role: userData.role,
      memberSince: userData.memberSince,
      dateOfBirth: userData.dateOfBirth,
      rank: userData.rank,
      pk: userData.pk,
      reservistsAssociation: userData.reservistsAssociation,
      associationMemberNumber: userData.associationMemberNumber,
      adminNotes: userData.adminNotes,
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
      title={isEditing ? "Benutzer bearbeiten" : "Benutzer erstellen"}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ValidatedFieldGroup
            label="Name"
            name="name"
            type="text"
            value={userData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            onBlur={(e) => handleBlur("name", e.target.value)}
            error={getFieldError("name")}
            showSuccess={isValidAndTouched("name", userData.name)}
            required
            maxLength={100}
            placeholder="Max Mustermann"
            disabled={isSubmitting}
            autoFocus={isEditing}
          />

          <GermanDatePicker
            id="modal-dateOfBirth"
            label="Geburtsdatum"
            value={userData.dateOfBirth}
            onChange={(date) => handleChange("dateOfBirth", date)}
            onBlur={() => handleBlur("dateOfBirth", userData.dateOfBirth)}
            disabled={isSubmitting}
            error={getFieldError("dateOfBirth")}
          />
        </div>

        <ValidatedFieldGroup
          label="Adresse"
          name="address"
          type="text"
          value={userData.address}
          onChange={(e) => handleChange("address", e.target.value)}
          onBlur={(e) => handleBlur("address", e.target.value)}
          error={getFieldError("address")}
          showSuccess={isValidAndTouched("address", userData.address)}
          maxLength={200}
          placeholder="Musterstraße 1, 12345 Musterstadt"
          disabled={isSubmitting}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ValidatedFieldGroup
            label="E-Mail"
            name="email"
            type="email"
            value={userData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            onBlur={(e) => handleBlur("email", e.target.value)}
            error={getFieldError("email")}
            showSuccess={isValidAndTouched("email", userData.email)}
            required
            placeholder="beispiel@email.de"
            disabled={isSubmitting}
            autoFocus={!isEditing}
          />

          <ValidatedFieldGroup
            label="Telefon"
            name="phone"
            type="tel"
            value={userData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            onBlur={(e) => handleBlur("phone", e.target.value)}
            error={getFieldError("phone")}
            showSuccess={isValidAndTouched("phone", userData.phone)}
            maxLength={30}
            placeholder="0123 456789"
            disabled={isSubmitting}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ValidatedFieldGroup
            label="Dienstgrad"
            name="rank"
            type="text"
            value={userData.rank}
            onChange={(e) => handleChange("rank", e.target.value)}
            onBlur={(e) => handleBlur("rank", e.target.value)}
            error={getFieldError("rank")}
            showSuccess={isValidAndTouched("rank", userData.rank)}
            maxLength={30}
            placeholder="z.B. Obergefreiter d.R."
            disabled={isSubmitting}
          />

          <ValidatedFieldGroup
            label="PK"
            name="pk"
            type="text"
            value={userData.pk}
            onChange={(e) => handleChange("pk", e.target.value)}
            onBlur={(e) => handleBlur("pk", e.target.value)}
            error={getFieldError("pk")}
            showSuccess={isValidAndTouched("pk", userData.pk)}
            maxLength={20}
            placeholder="z.B. 12345 A 67890"
            disabled={isSubmitting}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ValidatedFieldGroup
            label="Reservistenkameradschaft"
            name="reservistsAssociation"
            type="text"
            value={userData.reservistsAssociation}
            onChange={(e) => handleChange("reservistsAssociation", e.target.value)}
            onBlur={(e) => handleBlur("reservistsAssociation", e.target.value)}
            error={getFieldError("reservistsAssociation")}
            showSuccess={isValidAndTouched("reservistsAssociation", userData.reservistsAssociation)}
            maxLength={30}
            placeholder="z.B. RK MSE"
            disabled={isSubmitting}
          />

          <ValidatedFieldGroup
            label="Mitgliedsnummer im Verband"
            name="associationMemberNumber"
            type="text"
            value={userData.associationMemberNumber}
            onChange={(e) => handleChange("associationMemberNumber", e.target.value)}
            onBlur={(e) => handleBlur("associationMemberNumber", e.target.value)}
            error={getFieldError("associationMemberNumber")}
            showSuccess={isValidAndTouched("associationMemberNumber", userData.associationMemberNumber)}
            maxLength={30}
            placeholder="z.B. 1234567890"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="modal-hasPossessionCard" className="form-label">
            Waffenbesitzkarte
          </label>
          <div className="flex items-center gap-3">
            <input
              id="modal-hasPossessionCard"
              type="checkbox"
              checked={userData.hasPossessionCard}
              onChange={(e) => setUserData({ ...userData, hasPossessionCard: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              disabled={isSubmitting}
            />
            <label htmlFor="modal-hasPossessionCard" className="text-gray-700 cursor-pointer">
              Benutzer besitzt eigene Waffenbesitzkarte
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GermanDatePicker
            id="modal-memberSince"
            label="Mitglied seit"
            value={userData.memberSince}
            onChange={(date) => handleChange("memberSince", date)}
            onBlur={() => handleBlur("memberSince", userData.memberSince)}
            disabled={isSubmitting}
            error={getFieldError("memberSince")}
          />

          <div>
            <label htmlFor="modal-role" className="form-label">
              Rolle *
            </label>
            <select
              id="modal-role"
              value={userData.role}
              onChange={(e) => handleChange("role", e.target.value as UserRole)}
              onBlur={(e) => handleBlur("role", e.target.value)}
              required
              className={`form-input ${getFieldError("role") ? "border-red-500 focus:border-red-500" : ""}`}
              disabled={isSubmitting}
              aria-invalid={!!getFieldError("role")}
              aria-describedby={getFieldError("role") ? "role-error" : undefined}
            >
              <option value="MEMBER">Mitglied</option>
              <option value="ADMIN">Administrator</option>
            </select>
            {getFieldError("role") && (
              <p id="role-error" className="form-help text-red-600">
                {getFieldError("role")}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="modal-adminNotes" className="form-label">
            Administratoren-Notizen <span className="text-gray-400">(nur für Administratoren sichtbar)</span>
          </label>
          <textarea
            id="modal-adminNotes"
            value={userData.adminNotes}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= 4000) {
                setUserData({ ...userData, adminNotes: value });
              }
            }}
            onBlur={() => handleBlur("adminNotes", userData.adminNotes)}
            className={`form-input min-h-[120px] resize-y ${getFieldError("adminNotes") ? "border-red-500 focus:border-red-500" : ""}`}
            placeholder="Interne Notizen für Administratoren..."
            disabled={isSubmitting}
            maxLength={4000}
          />
          <div className="flex justify-between items-center mt-1">
            {getFieldError("adminNotes") && (
              <p className="form-help text-red-600">
                {getFieldError("adminNotes")}
              </p>
            )}
            {!getFieldError("adminNotes") && <span></span>}
            <span className={`text-sm ${userData.adminNotes.length > 3800 ? "text-orange-500" : "text-gray-500"}`}>
              {userData.adminNotes.length}/4000
            </span>
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
            {isEditing
              ? "Aktualisieren"
              : "Erstellen"}
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
}
