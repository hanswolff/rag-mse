"use client";

import { useMemo } from "react";
import { Modal } from "./modal";
import { LoadingButton } from "./loading-button";
import { GermanDatePicker } from "./german-date-picker";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { profileValidationConfig } from "@/lib/validation-schema";

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
  };
  setUserData: (data: { email: string; name: string; address: string; phone: string; role: UserRole; memberSince: string; dateOfBirth: string; rank: string; pk: string; reservistsAssociation: string; associationMemberNumber: string; hasPossessionCard: boolean }) => void;
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
  const { errors: validationErrors, validateField, markFieldAsTouched, isFieldValid } = useFormFieldValidation(profileValidationConfig);

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
      userData.hasPossessionCard !== base.hasPossessionCard
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
      memberSince: userData.memberSince,
      dateOfBirth: userData.dateOfBirth,
      rank: userData.rank,
      pk: userData.pk,
      reservistsAssociation: userData.reservistsAssociation,
      associationMemberNumber: userData.associationMemberNumber,
      hasPossessionCard: userData.hasPossessionCard,
    };

    // Mark all fields as touched when submitting to show validation errors
    markFieldAsTouched("email");
    markFieldAsTouched("name");
    markFieldAsTouched("address");
    markFieldAsTouched("phone");
    markFieldAsTouched("memberSince");
    markFieldAsTouched("dateOfBirth");
    markFieldAsTouched("rank");
    markFieldAsTouched("pk");
    markFieldAsTouched("reservistsAssociation");
    markFieldAsTouched("associationMemberNumber");

    validateField("email", values.email);
    validateField("name", values.name);
    validateField("address", values.address);
    validateField("phone", values.phone);
    validateField("memberSince", values.memberSince);
    validateField("dateOfBirth", values.dateOfBirth);
    validateField("rank", values.rank);
    validateField("pk", values.pk);
    validateField("reservistsAssociation", values.reservistsAssociation);
    validateField("associationMemberNumber", values.associationMemberNumber);

    const isValid =
      isFieldValid("email", values.email) &&
      isFieldValid("name", values.name) &&
      isFieldValid("address", values.address) &&
      isFieldValid("phone", values.phone) &&
      isFieldValid("memberSince", values.memberSince) &&
      isFieldValid("dateOfBirth", values.dateOfBirth) &&
      isFieldValid("rank", values.rank) &&
      isFieldValid("pk", values.pk) &&
      isFieldValid("reservistsAssociation", values.reservistsAssociation) &&
      isFieldValid("associationMemberNumber", values.associationMemberNumber);

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

          <GermanDatePicker
            id="modal-dateOfBirth"
            label="Geburtsdatum"
            value={userData.dateOfBirth}
            onChange={(date) => handleChange("dateOfBirth", date)}
            onBlur={() => handleBlur("dateOfBirth", userData.dateOfBirth)}
            disabled={isSubmitting}
            error={shouldShowFieldError("dateOfBirth")}
          />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="modal-rank" className="form-label">
              Dienstgrad
            </label>
            <input
              id="modal-rank"
              type="text"
              value={userData.rank}
              onChange={(e) => handleChange("rank", e.target.value)}
              onBlur={(e) => handleBlur("rank", e.target.value)}
              maxLength={30}
              className={`form-input ${
                shouldShowFieldError("rank") ? "border-red-500 focus:border-red-500" : ""
              }`}
              placeholder="z.B. Obergefreiter d.R."
              disabled={isSubmitting}
              aria-invalid={!!shouldShowFieldError("rank")}
              aria-describedby={shouldShowFieldError("rank") ? "rank-error" : undefined}
            />
            {shouldShowFieldError("rank") && (
              <p id="rank-error" className="form-help text-red-600">
                {combinedErrors.rank}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="modal-pk" className="form-label">
              PK
            </label>
            <input
              id="modal-pk"
              type="text"
              value={userData.pk}
              onChange={(e) => handleChange("pk", e.target.value)}
              onBlur={(e) => handleBlur("pk", e.target.value)}
              maxLength={20}
              className={`form-input ${
                shouldShowFieldError("pk") ? "border-red-500 focus:border-red-500" : ""
              }`}
              placeholder="z.B. 12345 A 67890"
              disabled={isSubmitting}
              aria-invalid={!!shouldShowFieldError("pk")}
              aria-describedby={shouldShowFieldError("pk") ? "pk-error" : undefined}
            />
            {shouldShowFieldError("pk") && (
              <p id="pk-error" className="form-help text-red-600">
                {combinedErrors.pk}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="modal-reservistsAssociation" className="form-label">
              Reservistenkameradschaft
            </label>
            <input
              id="modal-reservistsAssociation"
              type="text"
              value={userData.reservistsAssociation}
              onChange={(e) => handleChange("reservistsAssociation", e.target.value)}
              onBlur={(e) => handleBlur("reservistsAssociation", e.target.value)}
              maxLength={30}
              className={`form-input ${
                shouldShowFieldError("reservistsAssociation") ? "border-red-500 focus:border-red-500" : ""
              }`}
              placeholder="z.B. RK MSE"
              disabled={isSubmitting}
              aria-invalid={!!shouldShowFieldError("reservistsAssociation")}
              aria-describedby={shouldShowFieldError("reservistsAssociation") ? "reservistsAssociation-error" : undefined}
            />
            {shouldShowFieldError("reservistsAssociation") && (
              <p id="reservistsAssociation-error" className="form-help text-red-600">
                {combinedErrors.reservistsAssociation}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="modal-associationMemberNumber" className="form-label">
              Mitgliedsnummer im Verband
            </label>
            <input
              id="modal-associationMemberNumber"
              type="text"
              value={userData.associationMemberNumber}
              onChange={(e) => handleChange("associationMemberNumber", e.target.value)}
              onBlur={(e) => handleBlur("associationMemberNumber", e.target.value)}
              maxLength={30}
              className={`form-input ${
                shouldShowFieldError("associationMemberNumber") ? "border-red-500 focus:border-red-500" : ""
              }`}
              placeholder="z.B. 1234567890"
              disabled={isSubmitting}
              aria-invalid={!!shouldShowFieldError("associationMemberNumber")}
              aria-describedby={shouldShowFieldError("associationMemberNumber") ? "associationMemberNumber-error" : undefined}
            />
            {shouldShowFieldError("associationMemberNumber") && (
              <p id="associationMemberNumber-error" className="form-help text-red-600">
                {combinedErrors.associationMemberNumber}
              </p>
            )}
          </div>
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
            error={shouldShowFieldError("memberSince")}
          />

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
