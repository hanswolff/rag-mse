"use client";

import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { useCrossFieldValidation } from "@/lib/useCrossFieldValidation";
import { passwordChangeValidationConfig, passwordChangeFormSchema } from "@/lib/validation-schema";
import { LoadingButton } from "./loading-button";
import { PasswordRequirements } from "./password-requirements";
import { ValidatedFieldGroup } from "./validated-field-group";

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
  const { errors: validationErrors, validateField, validateAllFields, markFieldAsTouched, shouldShowError, isValidAndTouched } = useFormFieldValidation(passwordChangeValidationConfig);

  // Cross-field validation - only get custom validation errors (password matching, different from current)
  // Using customOnly to filter out field-level validation like "required"
  const crossFieldErrors = useCrossFieldValidation(
    passwordChangeFormSchema,
    { currentPassword, newPassword, confirmPassword },
    { customOnly: true }
  );

  const createChangeHandler = (name: string, onChange: (value: string) => void) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onChange(value);
      if (validationErrors[name]) {
        validateField(name, value);
      }
    };
  };

  const createBlurHandler = (name: string, value: string) => {
    return () => {
      markFieldAsTouched(name);
      validateField(name, value);
    };
  };

  const getFieldError = (fieldName: string, value: string): string | undefined => {
    // Only show cross-field errors when the field has a value (cross-field errors don't make sense for empty fields)
    if (crossFieldErrors[fieldName] && value.trim().length > 0) {
      return crossFieldErrors[fieldName];
    }
    return shouldShowError(fieldName, value) ? validationErrors[fieldName] : undefined;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const fieldValues: Record<string, string> = {
      currentPassword,
      newPassword,
      confirmPassword,
    };

    const isValid = validateAllFields(fieldValues) && Object.keys(crossFieldErrors).length === 0;
    if (!isValid) {
      return;
    }

    onSubmit();
  };

  return (
    <div className="card-compact">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Passwort ändern</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <ValidatedFieldGroup
          label="Aktuelles Passwort"
          name="currentPassword"
          type="password"
          value={currentPassword}
          onChange={createChangeHandler("currentPassword", onCurrentPasswordChange)}
          onBlur={createBlurHandler("currentPassword", currentPassword)}
          error={getFieldError("currentPassword", currentPassword)}
          showSuccess={isValidAndTouched("currentPassword", currentPassword)}
          required
          maxLength={72}
          placeholder="Ihr aktuelles Passwort"
          disabled={isChangingPassword}
          autoFocus
        />

        <ValidatedFieldGroup
          label="Neues Passwort"
          name="newPassword"
          type="password"
          value={newPassword}
          onChange={createChangeHandler("newPassword", onNewPasswordChange)}
          onBlur={createBlurHandler("newPassword", newPassword)}
          error={getFieldError("newPassword", newPassword)}
          showSuccess={isValidAndTouched("newPassword", newPassword)}
          required
          maxLength={72}
          placeholder="Ihr neues Passwort"
          disabled={isChangingPassword}
        />

        <ValidatedFieldGroup
          label="Passwort bestätigen"
          name="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={createChangeHandler("confirmPassword", onConfirmPasswordChange)}
          onBlur={createBlurHandler("confirmPassword", confirmPassword)}
          error={getFieldError("confirmPassword", confirmPassword)}
          showSuccess={isValidAndTouched("confirmPassword", confirmPassword)}
          required
          maxLength={72}
          placeholder="Neues Passwort wiederholen"
          disabled={isChangingPassword}
        />

        <LoadingButton
          type="submit"
          loading={isChangingPassword}
          loadingText="Wird geändert..."
          className="btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
        >
          Passwort ändern
        </LoadingButton>
      </form>

      <div className="mt-4 text-base sm:text-base text-gray-600">
        <p className="font-medium mb-2">Passwort-Anforderungen:</p>
        <PasswordRequirements password={newPassword} />
      </div>
    </div>
  );
}
