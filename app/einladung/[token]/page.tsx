"use client";

import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { validatePassword } from "@/lib/password-validation";
import { PasswordRequirements } from "@/components/password-requirements";
import { LoadingButton } from "@/components/loading-button";
import { ProfileFieldsFieldset, useProfileFormFields } from "@/components/profile-fields-fieldset";
import { normalizeDateInputValue } from "@/lib/date-picker-utils";
import { useCrossFieldValidation } from "@/lib/use-cross-field-validation";
import { mapServerErrorToField, PROFILE_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { resetPasswordFormSchema } from "@/lib/validation-schema";
import { AlertBox } from "@/components/alert-box";

interface InvitationStatus {
  email: string;
  role: "SITE_ADMINISTRATOR" | "ADMIN" | "AUDITOR" | "MEMBER";
  expiresAt: string;
  name: string;
  address: string;
  phone: string;
  memberSince: string;
  dateOfBirth: string;
  rank: string;
  pk: string;
  reservistsAssociation: string;
  associationMemberNumber: string;
  hasPossessionCard: boolean;
}

interface FormData {
  name: string;
  address: string;
  phone: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  rank: string;
  pk: string;
  reservistsAssociation: string;
  associationMemberNumber: string;
  hasPossessionCard: boolean;
}

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const { token } = use(params);

  const [status, setStatus] = useState<InvitationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fatalError, setFatalError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordServerErrors, setPasswordServerErrors] = useState<string[]>([]);
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    address: "",
    phone: "",
    password: "",
    confirmPassword: "",
    dateOfBirth: "",
    rank: "",
    pk: "",
    reservistsAssociation: "",
    associationMemberNumber: "",
    hasPossessionCard: false,
  });

  const {
    setServerFieldErrors,
    setFieldValue,
    handleFieldBlur,
    getFieldError,
    isFieldValidAndTouched,
    validateAllFields,
  } = useProfileFormFields(formData, setFormData);

  const passwordValidation = useMemo(() => validatePassword(formData.password), [formData.password]);
  const passwordErrors = [...passwordValidation.errors, ...passwordServerErrors];

  // Cross-field validation for password matching - only get custom errors (not field-level validation)
  const crossFieldErrors = useCrossFieldValidation(
    resetPasswordFormSchema,
    { password: formData.password, confirmPassword: formData.confirmPassword },
    { customOnly: true }
  );

  const showPasswordErrors = showPasswordValidation || formData.password.length > 0;
  const showConfirmPasswordError = (showPasswordValidation || formData.confirmPassword.length > 0) && crossFieldErrors.confirmPassword;

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/invitations/${token}`);
        const data = await response.json();
        if (!response.ok) {
          setFatalError(data.error || "Einladung ungültig");
          return;
        }
        setStatus(data);
        setFormData((current) => ({
          ...current,
          name: typeof data.name === "string" ? data.name : "",
          address: typeof data.address === "string" ? data.address : "",
          phone: typeof data.phone === "string" ? data.phone : "",
          dateOfBirth: normalizeDateInputValue(typeof data.dateOfBirth === "string" ? data.dateOfBirth : ""),
          rank: typeof data.rank === "string" ? data.rank : "",
          pk: typeof data.pk === "string" ? data.pk : "",
          reservistsAssociation: typeof data.reservistsAssociation === "string" ? data.reservistsAssociation : "",
          associationMemberNumber: typeof data.associationMemberNumber === "string" ? data.associationMemberNumber : "",
          hasPossessionCard: typeof data.hasPossessionCard === "boolean" ? data.hasPossessionCard : false,
        }));
      } catch {
        setFatalError("Einladung konnte nicht geladen werden");
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchStatus();
    }
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setShowPasswordValidation(true);
    setFormError("");
    setServerFieldErrors({});
    setPasswordServerErrors([]);
    setSuccess("");

    // Validate all profile fields using the helper
    const profileFieldValues: Record<string, string> = {
      name: formData.name,
      address: formData.address,
      phone: formData.phone,
      dateOfBirth: formData.dateOfBirth,
      rank: formData.rank,
      pk: formData.pk,
      reservistsAssociation: formData.reservistsAssociation,
      associationMemberNumber: formData.associationMemberNumber,
    };

    const profileDataIsValid = validateAllFields(profileFieldValues);
    if (!profileDataIsValid) {
      return;
    }

    if (!passwordValidation.isValid) {
      return;
    }

    if (crossFieldErrors.confirmPassword) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        const message = data.error || "Ein Fehler ist aufgetreten";
        if (response.status === 404 || response.status === 410) {
          setFatalError(message);
          return;
        }
        if (message === "Passwörter stimmen nicht überein") {
          setPasswordServerErrors([message]);
          return;
        }
        if (message.includes("Passwort muss") || message.includes("Passwort darf")) {
          setPasswordServerErrors(message.split(". ").filter((entry: string) => entry.trim().length > 0));
          return;
        }

        // Use the shared error mapper
        const fieldErrors = mapServerErrorToField(message, PROFILE_FIELD_KEYWORDS, data.fieldErrors);
        if (Object.keys(fieldErrors).length > 0) {
          setServerFieldErrors(fieldErrors);
          return;
        }
        setFormError(message);
        return;
      }

      setSuccess("Konto wurde erstellt. Login wird durchgeführt…");

      const signInResult = await signIn("credentials", {
        email: data.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.error) {
        setFormError("Login fehlgeschlagen. Bitte loggen Sie sich manuell ein.");
        return;
      }

      router.push("/profil");
    } catch {
      setFormError("Ein Fehler ist aufgetreten");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="text-gray-600">Einladung wird geladen…</div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 lg:py-10">
        <div className="card">
          <h1 className="text-2xl font-bold text-brand-blue-900">Einladung annehmen</h1>
          <p className="text-brand-blue-800 mt-2">
            Erstellen Sie Ihr Mitgliedskonto, um Zugriff auf Termine und News zu erhalten.
          </p>

          <AlertBox type="error" message={fatalError} className="mt-4" />

          <AlertBox type="error" message={formError} className="mt-4" />

          <AlertBox type="success" message={success} className="mt-4" />

          {status && (
            <div className="bg-gray-100 border border-gray-200 text-gray-700 px-4 py-3 rounded mt-4">
              Einladung für: <strong>{status.email}</strong>
            </div>
          )}

          {status && !fatalError && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <ProfileFieldsFieldset
                formData={formData}
                disabled={isSubmitting}
                onFieldChange={setFieldValue}
                onFieldBlur={handleFieldBlur}
                onHasPossessionCardChange={(checked) =>
                  setFormData((current) => ({ ...current, hasPossessionCard: checked }))
                }
                getFieldError={getFieldError}
                isValidAndTouched={isFieldValidAndTouched}
                emailSlot={
                  <div>
                    <label htmlFor="email" className="form-label">
                      E-Mail *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={status?.email ?? ""}
                      readOnly
                      required
                      className="form-input bg-gray-100 text-gray-700 cursor-not-allowed"
                      disabled={isSubmitting}
                    />
                  </div>
                }
              />

              <div>
                <label htmlFor="password" className="form-label">
                  Passwort *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    setPasswordServerErrors([]);
                  }}
                  required
                  maxLength={72}
                  className={`form-input ${passwordErrors.length > 0 && showPasswordErrors ? "border-red-500 focus:border-red-500" : ""}`}
                  disabled={isSubmitting}
                  aria-invalid={showPasswordErrors && passwordErrors.length > 0}
                  aria-describedby={showPasswordErrors && passwordErrors.length > 0 ? "invite-password-error" : undefined}
                />
                {showPasswordErrors && passwordErrors.length > 0 && (
                  <ul id="invite-password-error" className="mt-2 text-sm text-red-700 list-disc list-inside">
                    {passwordErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
                <PasswordRequirements password={formData.password} />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="form-label">
                  Passwort wiederholen *
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  maxLength={72}
                  className={`form-input ${showConfirmPasswordError ? "border-red-500 focus:border-red-500" : ""}`}
                  disabled={isSubmitting}
                  aria-invalid={!!showConfirmPasswordError}
                  aria-describedby={showConfirmPasswordError ? "invite-confirm-password-error" : undefined}
                />
                {showConfirmPasswordError && (
                  <p id="invite-confirm-password-error" className="mt-2 text-sm text-red-700">
                    {crossFieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              <LoadingButton
                type="submit"
                loading={isSubmitting}
                loadingText="Wird erstellt…"
                className="w-full btn-primary py-2"
              >
                Konto erstellen
              </LoadingButton>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
