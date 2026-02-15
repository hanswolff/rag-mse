"use client";

import { useState } from "react";
import { BackLink } from "@/components/back-link";
import { LoadingButton } from "@/components/loading-button";
import { ValidatedFieldGroup } from "@/components/validated-field-group";
import type { ContactFormData } from "@/lib/contact-validation";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { mapServerErrorToFields, CONTACT_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { contactValidationConfig } from "@/lib/validation-schema";

export default function ContactPage() {
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    message: "",
  });
  const [error, setError] = useState<string | string[]>("");
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    errors: validationErrors,
    validateField,
    validateAllFields,
    markFieldAsTouched,
    shouldShowError,
    isValidAndTouched,
  } = useFormFieldValidation(contactValidationConfig);

  const clearError = () => {
    if (error) setError("");
  };

  const handleInputChange = (field: keyof ContactFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearError();
    setServerFieldErrors((prev) => ({ ...prev, [field]: undefined }));

    // Re-validate if there's already an error
    if (validationErrors[field]) {
      validateField(field, value);
    }
  };

  const handleBlur = (field: keyof ContactFormData) => (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    markFieldAsTouched(field);
    validateField(field, e.target.value);
  };

  const getFieldError = (field: keyof ContactFormData): string | undefined => {
    if (serverFieldErrors[field]) return serverFieldErrors[field];
    return shouldShowError(field, formData[field]) ? validationErrors[field] : undefined;
  };

  const fieldValues: Record<string, string> = {
    name: formData.name,
    email: formData.email,
    message: formData.message,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setServerFieldErrors({});
    setSuccess(false);

    // Validate all fields using the helper
    const isValid = validateAllFields(fieldValues);
    if (!isValid) {
      setError("Bitte korrigieren Sie die Fehler im Formular");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          // Use the shared error mapper for each error message
          const mappedFieldErrors: Partial<Record<keyof ContactFormData, string>> = {};
          for (const message of data.errors as string[]) {
            const fieldErrors = mapServerErrorToFields(message, CONTACT_FIELD_KEYWORDS);
            Object.assign(mappedFieldErrors, fieldErrors);
          }
          setServerFieldErrors(mappedFieldErrors);
          if (Object.keys(mappedFieldErrors).length === 0) {
            setError(data.errors);
          }
        } else {
          setError(data.error || "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
        }
      } else {
        setSuccess(true);
        setFormData({ name: "", email: "", message: "" });
      }
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <BackLink href="/" className="text-base">
            Zurück zur Startseite
          </BackLink>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">Kontakt</h1>
          <p className="text-gray-600 mt-2 text-base sm:text-base">
            Haben Sie Fragen oder Anregungen? Schreiben Sie uns!
          </p>
        </div>

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-3 sm:px-4 py-3 rounded mb-4 text-base">
            Ihre Nachricht wurde erfolgreich gesendet. Wir werden uns schnellstmöglich bei Ihnen melden.
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-3 rounded mb-4 text-base">
            {Array.isArray(error) ? (
              <ul className="list-disc list-inside">
                {error.map((err, index) => (
                  <li key={index}>{err}</li>
                ))}
              </ul>
            ) : (
              error
            )}
          </div>
        )}

        <div className="card">
          <form role="form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-6" noValidate>
            <ValidatedFieldGroup
              label="Name"
              name="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name")(e as React.ChangeEvent<HTMLInputElement>)}
              onBlur={(e) => handleBlur("name")(e as React.FocusEvent<HTMLInputElement>)}
              error={getFieldError("name")}
              showSuccess={isValidAndTouched("name", formData.name)}
              required
              maxLength={100}
              placeholder="Ihr Name"
              disabled={isLoading || success}
              autoFocus
            />

            <ValidatedFieldGroup
              label="E-Mail"
              name="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email")(e as React.ChangeEvent<HTMLInputElement>)}
              onBlur={(e) => handleBlur("email")(e as React.FocusEvent<HTMLInputElement>)}
              error={getFieldError("email")}
              showSuccess={isValidAndTouched("email", formData.email)}
              required
              placeholder="ihre@email.de"
              disabled={isLoading || success}
            />

            <ValidatedFieldGroup
              as="textarea"
              label="Nachricht"
              name="message"
              value={formData.message}
              onChange={(e) => handleInputChange("message")(e as React.ChangeEvent<HTMLTextAreaElement>)}
              onBlur={(e) => handleBlur("message")(e as React.FocusEvent<HTMLTextAreaElement>)}
              error={getFieldError("message")}
              showSuccess={isValidAndTouched("message", formData.message)}
              required
              rows={6}
              maxLength={2000}
              placeholder="Ihre Nachricht..."
              disabled={isLoading || success}
              helpText={!getFieldError("message") ? `${formData.message.length} / 2000 Zeichen` : undefined}
            />

            <div className="flex justify-end">
              <LoadingButton
                type="submit"
                loading={isLoading}
                disabled={success}
                loadingText="Wird gesendet..."
                className="btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
              >
                Nachricht senden
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
