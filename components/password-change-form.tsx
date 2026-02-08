"use client";

import { useMemo } from "react";
import { getPasswordRequirements } from "@/lib/password-validation";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { passwordChangeValidationConfig } from "@/lib/validation-schema";

interface PasswordChangeFormProps {
  isChangingPassword: boolean;
  onSubmit: () => void | Promise<void>;
  currentPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  error?: string;
}

export function PasswordChangeForm({
  isChangingPassword,
  onSubmit,
  currentPassword,
  onCurrentPasswordChange,
  newPassword,
  onNewPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  error,
}: PasswordChangeFormProps) {
  const { errors: validationErrors, validateField, markFieldAsTouched, shouldShowError, isFieldValid } = useFormFieldValidation(passwordChangeValidationConfig);

  // Cross-field validation: passwords must match
  const passwordsMatchError = useMemo(() => {
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      return "Neues Passwort und Passwortbestätigung stimmen nicht überein";
    }
    return null;
  }, [newPassword, confirmPassword]);

  // Cross-field validation: new password must differ from current password
  const passwordDifferenceError = useMemo(() => {
    if (currentPassword && newPassword && currentPassword === newPassword) {
      return "Neues Passwort muss vom aktuellen Passwort abweichen";
    }
    return null;
  }, [currentPassword, newPassword]);

  // Combine all errors
  const combinedErrors = useMemo(() => {
    const errors = { ...validationErrors };
    if (passwordsMatchError) {
      errors.confirmPassword = passwordsMatchError;
    }
    if (passwordDifferenceError) {
      errors.newPassword = passwordDifferenceError;
    }
    return errors;
  }, [validationErrors, passwordsMatchError, passwordDifferenceError]);

  const handleChange = (name: string, value: string, onChange: (value: string) => void) => {
    onChange(value);
    if (validationErrors[name]) {
      validateField(name, value);
    }
  };

  const handleBlur = (name: string, value: string) => {
    markFieldAsTouched(name);
    validateField(name, value);
  };

  const shouldShowFieldError = (fieldName: string, value: string) => {
    const isServerError = !!error && !validationErrors[fieldName];
    if (isServerError) return error;
    return shouldShowError(fieldName, value) ? combinedErrors[fieldName] : undefined;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const values = {
      currentPassword,
      newPassword,
      confirmPassword,
    };

    validateField("currentPassword", values.currentPassword);
    validateField("newPassword", values.newPassword);
    validateField("confirmPassword", values.confirmPassword);

    const isValid =
      isFieldValid("currentPassword", values.currentPassword) &&
      isFieldValid("newPassword", values.newPassword) &&
      isFieldValid("confirmPassword", values.confirmPassword) &&
      !passwordsMatchError &&
      !passwordDifferenceError;

    if (!isValid) {
      e.preventDefault();
      return;
    }

    onSubmit();
  };

  return (
    <div className="card-compact">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Passwort ändern</h2>

      {(error || Object.keys(combinedErrors).some(key => combinedErrors[key])) && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          {!error && Object.keys(combinedErrors).some(key => combinedErrors[key]) && (
            <ul className="list-disc list-inside">
              {Object.entries(combinedErrors)
                .filter(([, err]) => err)
                .map(([field, err]) => (
                  <li key={field}>{err}</li>
                ))}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="currentPassword" className="form-label">
            Aktuelles Passwort *
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => handleChange("currentPassword", e.target.value, onCurrentPasswordChange)}
            onBlur={(e) => handleBlur("currentPassword", e.target.value)}
            required
            maxLength={72}
            className={`form-input ${
              shouldShowFieldError("currentPassword", currentPassword) ? "border-red-500 focus:border-red-500" : ""
            }`}
            placeholder="Ihr aktuelles Passwort"
            disabled={isChangingPassword}
            autoFocus
            aria-invalid={!!shouldShowFieldError("currentPassword", currentPassword)}
            aria-describedby={shouldShowFieldError("currentPassword", currentPassword) ? "currentPassword-error" : undefined}
          />
          {shouldShowFieldError("currentPassword", currentPassword) && (
            <p id="currentPassword-error" className="form-help text-red-600">
              {combinedErrors.currentPassword}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="newPassword" className="form-label">
            Neues Passwort *
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => handleChange("newPassword", e.target.value, onNewPasswordChange)}
            onBlur={(e) => handleBlur("newPassword", e.target.value)}
            required
            maxLength={72}
            className={`form-input ${
              shouldShowFieldError("newPassword", newPassword) ? "border-red-500 focus:border-red-500" : ""
            }`}
            placeholder="Ihr neues Passwort"
            disabled={isChangingPassword}
            aria-invalid={!!shouldShowFieldError("newPassword", newPassword)}
            aria-describedby={shouldShowFieldError("newPassword", newPassword) ? "newPassword-error" : undefined}
          />
          {shouldShowFieldError("newPassword", newPassword) && (
            <p id="newPassword-error" className="form-help text-red-600">
              {combinedErrors.newPassword}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="form-label">
            Passwort bestätigen *
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => handleChange("confirmPassword", e.target.value, onConfirmPasswordChange)}
            onBlur={(e) => handleBlur("confirmPassword", e.target.value)}
            required
            maxLength={72}
            className={`form-input ${
              shouldShowFieldError("confirmPassword", confirmPassword) ? "border-red-500 focus:border-red-500" : ""
            }`}
            placeholder="Neues Passwort wiederholen"
            disabled={isChangingPassword}
            aria-invalid={!!shouldShowFieldError("confirmPassword", confirmPassword)}
            aria-describedby={shouldShowFieldError("confirmPassword", confirmPassword) ? "confirmPassword-error" : undefined}
          />
          {shouldShowFieldError("confirmPassword", confirmPassword) && (
            <p id="confirmPassword-error" className="form-help text-red-600">
              {combinedErrors.confirmPassword}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isChangingPassword}
          className="btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
        >
          {isChangingPassword ? "Wird geändert..." : "Passwort ändern"}
        </button>
      </form>

      <div className="mt-4 text-base sm:text-base text-gray-600">
        <p className="font-medium mb-2">Passwort-Anforderungen:</p>
        <ul className="list-disc list-inside space-y-1 text-base">
          {getPasswordRequirements().map((req) => (
            <li key={req}>{req}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
