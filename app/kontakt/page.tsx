"use client";

import { useState } from "react";
import { BackLink } from "@/components/back-link";
import { LoadingButton } from "@/components/loading-button";
import type { ContactFormData } from "@/lib/contact-validation";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { contactValidationConfig } from "@/lib/validation-schema";

export default function ContactPage() {
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    message: "",
  });
  const [error, setError] = useState<string | string[]>("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { errors: validationErrors, validateField, markFieldAsTouched, shouldShowError, isFieldValid } = useFormFieldValidation(contactValidationConfig);

  const clearError = () => {
    if (error) setError("");
  };

  const handleInputChange = (field: keyof ContactFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    clearError();

    if (validationErrors[field]) {
      validateField(field, e.target.value);
    }
  };

  const handleBlur = (field: keyof ContactFormData) => (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    markFieldAsTouched(field);
    validateField(field, e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validate all fields
    validateField("name", formData.name);
    validateField("email", formData.email);
    validateField("message", formData.message);

    // Check validation synchronously
    const nameValid = isFieldValid("name", formData.name);
    const emailValid = isFieldValid("email", formData.email);
    const messageValid = isFieldValid("message", formData.message);

    if (!nameValid || !emailValid || !messageValid) {
      // Collect specific error messages
      const errors: string[] = [];
      if (!nameValid && validationErrors.name) errors.push(validationErrors.name);
      if (!emailValid && validationErrors.email) errors.push(validationErrors.email);
      if (!messageValid && validationErrors.message) errors.push(validationErrors.message);
      setError(errors.length > 0 ? errors : "Bitte korrigieren Sie die Fehler im Formular");
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
          setError(data.errors);
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

  const shouldShowFieldError = (fieldName: string, value: string) => {
    return shouldShowError(fieldName, value) ? validationErrors[fieldName] : undefined;
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
            <div>
              <label htmlFor="name" className="form-label">
                Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange("name")}
                onBlur={handleBlur("name")}
                maxLength={100}
                className={`form-input ${
                  shouldShowFieldError("name", formData.name) ? "border-red-500 focus:border-red-500" : ""
                }`}
                placeholder="Ihr Name"
                disabled={isLoading || success}
                autoFocus
                aria-invalid={!!shouldShowFieldError("name", formData.name)}
              />
              {shouldShowFieldError("name", formData.name) && (
                <p className="form-help text-red-600">
                  {validationErrors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="form-label">
                E-Mail *
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange("email")}
                onBlur={handleBlur("email")}
                className={`form-input ${
                  shouldShowFieldError("email", formData.email) ? "border-red-500 focus:border-red-500" : ""
                }`}
                placeholder="ihre@email.de"
                disabled={isLoading || success}
                aria-invalid={!!shouldShowFieldError("email", formData.email)}
              />
              {shouldShowFieldError("email", formData.email) && (
                <p className="form-help text-red-600">
                  {validationErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="message" className="form-label">
                Nachricht *
              </label>
              <textarea
                id="message"
                value={formData.message}
                onChange={handleInputChange("message")}
                onBlur={handleBlur("message")}
                rows={6}
                maxLength={2000}
                className={`form-textarea ${
                  shouldShowFieldError("message", formData.message) ? "border-red-500 focus:border-red-500" : ""
                }`}
                placeholder="Ihre Nachricht..."
                disabled={isLoading || success}
                aria-invalid={!!shouldShowFieldError("message", formData.message)}
              />
              <div className="flex justify-between items-center">
                <p className="form-help">
                  {formData.message.length} / 2000 Zeichen
                </p>
                {shouldShowFieldError("message", formData.message) && (
                  <p className="form-help text-red-600">
                    {validationErrors.message}
                  </p>
                )}
              </div>
            </div>

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
