"use client";

import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { validatePassword } from "@/lib/password-validation";
import { PasswordRequirements } from "@/components/password-requirements";
import { LoadingButton } from "@/components/loading-button";
import { GermanDatePicker } from "@/components/german-date-picker";
import { ValidatedFieldGroup } from "@/components/validated-field-group";
import { normalizeDateInputValue } from "@/lib/date-picker-utils";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { useCrossFieldValidation } from "@/lib/useCrossFieldValidation";
import { mapServerErrorToField, PROFILE_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { profileValidationConfig, resetPasswordFormSchema } from "@/lib/validation-schema";

interface InvitationStatus {
  email: string;
  role: "ADMIN" | "MEMBER";
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
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
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
    errors: validationErrors,
    validateField,
    validateAllFields,
    markFieldAsTouched,
    shouldShowError,
    isValidAndTouched,
  } = useFormFieldValidation(profileValidationConfig);

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

  const getFieldError = (fieldName: keyof typeof formData): string | undefined => {
    if (serverFieldErrors[fieldName]) return serverFieldErrors[fieldName];
    return shouldShowError(fieldName, formData[fieldName] as string)
      ? validationErrors[fieldName]
      : undefined;
  };

  const setFieldValue = (fieldName: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [fieldName]: value }));
    setServerFieldErrors((prev) => ({ ...prev, [fieldName]: "" }));

    if (validationErrors[fieldName]) {
      validateField(fieldName, value);
    }
  };

  const handleFieldBlur = (fieldName: keyof typeof formData, value: string) => {
    markFieldAsTouched(fieldName);
    validateField(fieldName, value);
  };

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
        const fieldErrors = mapServerErrorToField(message, PROFILE_FIELD_KEYWORDS);
        if (Object.keys(fieldErrors).length > 0) {
          setServerFieldErrors(fieldErrors);
          return;
        }
        setFormError(message);
        return;
      }

      setSuccess("Konto wurde erstellt. Anmeldung wird durchgeführt...");

      const signInResult = await signIn("credentials", {
        email: data.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.error) {
        setFormError("Anmeldung fehlgeschlagen. Bitte melden Sie sich manuell an.");
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
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Einladung wird geladen...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="card">
          <h1 className="text-2xl font-bold text-brand-blue-900">Einladung annehmen</h1>
          <p className="text-brand-blue-800 mt-2">
            Erstellen Sie Ihr Mitgliedskonto, um Zugriff auf Termine und Neuigkeiten zu erhalten.
          </p>

          {fatalError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
              {fatalError}
            </div>
          )}

          {formError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
              {formError}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mt-4">
              {success}
            </div>
          )}

          {status && (
            <div className="bg-gray-100 border border-gray-200 text-gray-700 px-4 py-3 rounded mt-4">
              Einladung für: <strong>{status.email}</strong>
            </div>
          )}

          {status && !fatalError && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ValidatedFieldGroup
                  label="Name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFieldValue("name", e.target.value)}
                  onBlur={(e) => handleFieldBlur("name", e.target.value)}
                  error={getFieldError("name")}
                  showSuccess={isValidAndTouched("name", formData.name)}
                  required
                  maxLength={100}
                  disabled={isSubmitting}
                  autoFocus
                />

                <GermanDatePicker
                  id="dateOfBirth"
                  label="Geburtsdatum"
                  value={formData.dateOfBirth}
                  onChange={(date) => setFieldValue("dateOfBirth", date)}
                  onBlur={() => handleFieldBlur("dateOfBirth", formData.dateOfBirth)}
                  disabled={isSubmitting}
                  error={getFieldError("dateOfBirth")}
                  showSuccess={isValidAndTouched("dateOfBirth", formData.dateOfBirth)}
                />
              </div>

              <ValidatedFieldGroup
                label="Adresse"
                name="address"
                type="text"
                value={formData.address}
                onChange={(e) => setFieldValue("address", e.target.value)}
                onBlur={(e) => handleFieldBlur("address", e.target.value)}
                error={getFieldError("address")}
                showSuccess={isValidAndTouched("address", formData.address)}
                maxLength={200}
                placeholder="Musterstraße 1, 12345 Musterstadt"
                disabled={isSubmitting}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <ValidatedFieldGroup
                  label="Telefon"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFieldValue("phone", e.target.value)}
                  onBlur={(e) => handleFieldBlur("phone", e.target.value)}
                  error={getFieldError("phone")}
                  showSuccess={isValidAndTouched("phone", formData.phone)}
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
                  value={formData.rank}
                  onChange={(e) => setFieldValue("rank", e.target.value)}
                  onBlur={(e) => handleFieldBlur("rank", e.target.value)}
                  error={getFieldError("rank")}
                  showSuccess={isValidAndTouched("rank", formData.rank)}
                  maxLength={30}
                  placeholder="z.B. Obergefreiter d.R."
                  disabled={isSubmitting}
                />

                <ValidatedFieldGroup
                  label="PK"
                  name="pk"
                  type="text"
                  value={formData.pk}
                  onChange={(e) => setFieldValue("pk", e.target.value)}
                  onBlur={(e) => handleFieldBlur("pk", e.target.value)}
                  error={getFieldError("pk")}
                  showSuccess={isValidAndTouched("pk", formData.pk)}
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
                  value={formData.reservistsAssociation}
                  onChange={(e) => setFieldValue("reservistsAssociation", e.target.value)}
                  onBlur={(e) => handleFieldBlur("reservistsAssociation", e.target.value)}
                  error={getFieldError("reservistsAssociation")}
                  showSuccess={isValidAndTouched("reservistsAssociation", formData.reservistsAssociation)}
                  maxLength={30}
                  placeholder="z.B. RK MSE"
                  disabled={isSubmitting}
                />

                <ValidatedFieldGroup
                  label="Mitgliedsnummer im Verband"
                  name="associationMemberNumber"
                  type="text"
                  value={formData.associationMemberNumber}
                  onChange={(e) => setFieldValue("associationMemberNumber", e.target.value)}
                  onBlur={(e) => handleFieldBlur("associationMemberNumber", e.target.value)}
                  error={getFieldError("associationMemberNumber")}
                  showSuccess={isValidAndTouched("associationMemberNumber", formData.associationMemberNumber)}
                  maxLength={30}
                  placeholder="z.B. 1234567890"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="form-label">Waffenbesitzkarte</label>
                <div className="flex items-center gap-3">
                  <input
                    id="hasPossessionCard"
                    name="hasPossessionCard"
                    type="checkbox"
                    checked={formData.hasPossessionCard}
                    onChange={(e) => setFormData({ ...formData, hasPossessionCard: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <label htmlFor="hasPossessionCard" className="text-gray-700 cursor-pointer">
                    Ich besitze eine eigene Waffenbesitzkarte
                  </label>
                </div>
              </div>

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
                loadingText="Wird erstellt..."
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
