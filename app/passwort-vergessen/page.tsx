"use client";

import { useState } from "react";
import { BackLink } from "@/components/back-link";

interface UseForgotPasswordFormResult {
  email: string;
  message: string;
  error: string;
  isLoading: boolean;
  isSubmitted: boolean;
  setEmail: (email: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

function useForgotPasswordForm(): UseForgotPasswordFormResult {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const clearError = () => {
    if (error) setError("");
  };

  const setEmailWithClear = (newEmail: string) => {
    setEmail(newEmail);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Ein Fehler ist aufgetreten");
      } else {
        setMessage(data.message || "Wenn diese E-Mail registriert ist, erhalten Sie in Kürze einen Link.");
        setIsSubmitted(true);
      }
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email,
    message,
    error,
    isLoading,
    isSubmitted,
    setEmail: setEmailWithClear,
    handleSubmit,
  };
}

export default function ForgotPasswordPage() {
  const { email, message, error, isLoading, isSubmitted, setEmail, handleSubmit } = useForgotPasswordForm();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="card">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 text-brand-blue-900">
            RAG Schießsport MSE
          </h1>
          <h2 className="text-lg sm:text-xl font-semibold text-center mb-4 sm:mb-6 text-brand-red-700">
            Passwort vergessen
          </h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-3 rounded mb-4 text-base">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-3 sm:px-4 py-3 rounded mb-4 text-base">
              {message}
            </div>
          )}

          {!isSubmitted && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="form-label">
                  E-Mail
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
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
              >
                {isLoading ? "Wird gesendet..." : "Link anfordern"}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-base text-gray-600">
            <BackLink href="/login">
              Zurück zum Login
            </BackLink>
          </div>
        </div>
      </div>
    </main>
  );
}
