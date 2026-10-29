"use client";

import { useState } from "react";
import { BackLink } from "@/components/back-link";
import { LoadingButton } from "@/components/loading-button";
import { forgotPasswordFormSchema } from "@/lib/validation-schema";
import { getFieldErrors } from "@/lib/zod-form-errors";
import { apiFetch, ApiError } from "@/lib/api-fetch";
import { mapServerErrorToField, AUTH_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { AlertBox } from "@/components/alert-box";
import { AuthCardShell } from "@/components/auth-card-shell";

interface UseForgotPasswordFormResult {
  email: string;
  message: string;
  error: string;
  emailError: string;
  isLoading: boolean;
  isSubmitted: boolean;
  setEmail: (email: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

function useForgotPasswordForm(): UseForgotPasswordFormResult {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const clearError = () => {
    if (error) setError("");
    if (emailError) setEmailError("");
  };

  const setEmailWithClear = (newEmail: string) => {
    setEmail(newEmail);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailError("");
    setMessage("");

    const validation = forgotPasswordFormSchema.safeParse({ email });
    if (!validation.success) {
      const nextFieldErrors = getFieldErrors(validation.error);
      setEmailError(nextFieldErrors.email || "Bitte geben Sie eine gültige E-Mail-Adresse ein");
      return;
    }

    setIsLoading(true);

    try {
      const data = await apiFetch<{ message?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: { email },
      });

      setMessage(data.message || "Wenn diese E-Mail registriert ist, erhalten Sie in Kürze einen Link.");
      setIsSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped = mapServerErrorToField(err.message, AUTH_FIELD_KEYWORDS);
        if (mapped.email) {
          setEmailError(mapped.email);
        } else {
          setError(err.message);
        }
      } else {
        setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email,
    message,
    error,
    emailError,
    isLoading,
    isSubmitted,
    setEmail: setEmailWithClear,
    handleSubmit,
  };
}

export default function ForgotPasswordPage() {
  const { email, message, error, emailError, isLoading, isSubmitted, setEmail, handleSubmit } = useForgotPasswordForm();

  return (
    <AuthCardShell title="Passwort vergessen">
      <AlertBox type="error" message={error} className="mb-4 text-base" />

      <AlertBox type="success" message={message} className="mb-4 text-base" />

      {!isSubmitted && (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="form-label">
              E-Mail *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
              placeholder="Ihre E-Mail-Adresse"
              disabled={isLoading}
              autoFocus
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "forgot-email-error" : undefined}
            />
            {emailError && (
              <p id="forgot-email-error" className="form-help text-red-600">
                {emailError}
              </p>
            )}
          </div>

          <LoadingButton
            type="submit"
            loading={isLoading}
            loadingText="Wird gesendet…"
            className="w-full btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
          >
            Link anfordern
          </LoadingButton>
        </form>
      )}

      <div className="mt-6 text-center text-base text-gray-600">
        <BackLink href="/login">
          Zurück zum Login
        </BackLink>
      </div>
    </AuthCardShell>
  );
}
