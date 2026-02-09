"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { validatePassword, getPasswordRequirements } from "@/lib/password-validation";
import { LoadingButton } from "@/components/loading-button";

interface UseResetPasswordFormResult {
  password: string;
  confirmPassword: string;
  message: string;
  error: string;
  isLoading: boolean;
  isChanged: boolean;
  isValidToken: boolean;
  tokenError: string;
  setPassword: (password: string) => void;
  setConfirmPassword: (confirmPassword: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

function useResetPasswordForm(token: string): UseResetPasswordFormResult {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [tokenError, setTokenError] = useState("");

  useEffect(() => {
    async function validateToken() {
      try {
        const response = await fetch(`/api/auth/reset-password/${token}`);
        const data = await response.json();

        if (!response.ok) {
          setTokenError(data.error || "Ungültiger Link");
        } else {
          setIsValidToken(true);
        }
      } catch {
        setTokenError("Ein Fehler ist aufgetreten");
      }
    }

    if (token) {
      validateToken();
    } else {
      setTokenError("Ungültiger Link");
    }
  }, [token]);

  const clearError = () => {
    if (error) setError("");
  };

  const setPasswordWithClear = (newPassword: string) => {
    setPassword(newPassword);
    clearError();
  };

  const setConfirmPasswordWithClear = (newConfirmPassword: string) => {
    setConfirmPassword(newConfirmPassword);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein");
      setIsLoading(false);
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors.join(". "));
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/auth/reset-password/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Ein Fehler ist aufgetreten");
      } else {
        setMessage(data.message || "Passwort wurde erfolgreich geändert");
        setIsChanged(true);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    password,
    confirmPassword,
    message,
    error,
    isLoading,
    isChanged,
    isValidToken,
    tokenError,
    setPassword: setPasswordWithClear,
    setConfirmPassword: setConfirmPasswordWithClear,
    handleSubmit,
  };
}

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const {
    password,
    confirmPassword,
    message,
    error,
    isLoading,
    isChanged,
    isValidToken,
    tokenError,
    setPassword,
    setConfirmPassword,
    handleSubmit,
  } = useResetPasswordForm(token);

  if (tokenError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="card">
            <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 text-brand-blue-900">
              RAG Schießsport MSE
            </h1>
            <h2 className="text-lg sm:text-xl font-semibold text-center mb-4 sm:mb-6 text-brand-red-700">
              Passwort zurücksetzen
            </h2>

            <div className="bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-3 rounded mb-4 text-base">
              {tokenError}
            </div>

            <div className="mt-6 text-center text-base text-gray-600">
              <a href="/passwort-vergessen" className="link-primary">
                Neuen Link anfordern
              </a>
              {" · "}
              <a href="/login" className="link-primary">
                Zum Login
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!isValidToken && !tokenError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="card">
            <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 text-brand-blue-900">
              RAG Schießsport MSE
            </h1>
            <h2 className="text-lg sm:text-xl font-semibold text-center mb-4 sm:mb-6 text-brand-red-700">
              Passwort zurücksetzen
            </h2>

            <div className="text-center text-gray-700">Wird geladen...</div>
          </div>
        </div>
      </main>
    );
  }

  if (isChanged) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="card">
            <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 text-brand-blue-900">
              RAG Schießsport MSE
            </h1>
            <h2 className="text-lg sm:text-xl font-semibold text-center mb-4 sm:mb-6 text-brand-red-700">
              Passwort zurücksetzen
            </h2>

            <div className="bg-green-100 border border-green-400 text-green-700 px-3 sm:px-4 py-3 rounded mb-4 text-base">
              {message}
            </div>

            <div className="mt-6 text-center text-base text-gray-600">
              Sie werden automatisch zum Login weitergeleitet...
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="card">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 text-brand-blue-900">
            RAG Schießsport MSE
          </h1>
          <h2 className="text-lg sm:text-xl font-semibold text-center mb-4 sm:mb-6 text-brand-red-700">
            Passwort zurücksetzen
          </h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-3 rounded mb-4 text-base">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="form-label">
                Neues Passwort
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={200}
                className="form-input"
                placeholder="Neues Passwort"
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="form-label">
                Passwort bestätigen
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                maxLength={200}
                className="form-input"
                placeholder="Passwort bestätigen"
                disabled={isLoading}
              />
            </div>

            <LoadingButton
              type="submit"
              loading={isLoading}
              loadingText="Wird geändert..."
              className="w-full btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
            >
              Passwort ändern
            </LoadingButton>
          </form>

          <div className="mt-6 text-base text-gray-600">
            <p className="font-medium mb-2">Passwort-Anforderungen:</p>
            <ul className="list-disc list-inside space-y-1 text-base">
              {getPasswordRequirements().map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 text-center text-base text-gray-600">
            <a href="/login" className="link-primary">
              Abbrechen und zum Login
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
