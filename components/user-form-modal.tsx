"use client";

import { Modal } from "./modal";
import { AlertBox } from "./alert-box";
import { ConfirmCloseModal } from "./confirm-close-modal";
import { LoadingButton } from "./loading-button";
import { GermanDatePicker } from "./german-date-picker";
import { ValidatedFieldGroup } from "./validated-field-group";
import { useFormModal } from "@/lib/use-form-modal";
import { PROFILE_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import type { FieldError } from "@/lib/server-error-mapper";
import { adminUserValidationConfig } from "@/lib/validation-schema";
import { Permissions } from "@/lib/permissions";

type UserRole = "SITE_ADMINISTRATOR" | "ADMIN" | "AUDITOR" | "MEMBER";

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
  fieldErrors?: FieldError[];
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
  fieldErrors,
  initialUserData,
}: UserFormModalProps) {
  const {
    getFieldError,
    handleChange,
    handleBlur,
    handleClose,
    handleSubmit,
    showCloseConfirm,
    handleConfirmClose,
    cancelClose,
    isValidAndTouched,
    generalErrors,
  } = useFormModal({
    validationConfig: adminUserValidationConfig,
    formData: userData,
    setFormData: setUserData,
    defaultData: initialNewUser,
    initialData: initialUserData,
    isOpen,
    isSubmitting,
    onClose,
    onSubmit,
    serverErrors: errors,
    fieldErrors,
    fieldKeywords: PROFILE_FIELD_KEYWORDS,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "Benutzer bearbeiten" : "Benutzer erstellen"}
      size="2xl"
      closeOnOutsideClick={false}
      closeOnEscape={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {Object.keys(generalErrors).length === 0 && (
          <AlertBox type="error" message={errors.general} />
        )}
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
              onChange={(e) => handleChange("hasPossessionCard", e.target.checked)}
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
              <option value="SITE_ADMINISTRATOR" disabled>
                {Permissions.getRoleLabel("SITE_ADMINISTRATOR")}
              </option>
              <option value="MEMBER">{Permissions.getRoleLabel("MEMBER")}</option>
              <option value="ADMIN">{Permissions.getRoleLabel("ADMIN")}</option>
              <option value="AUDITOR">{Permissions.getRoleLabel("AUDITOR")}</option>
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
      <ConfirmCloseModal
        isOpen={showCloseConfirm}
        onConfirm={handleConfirmClose}
        onCancel={cancelClose}
      />
    </Modal>
  );
}
