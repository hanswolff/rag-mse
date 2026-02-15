"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { isAdmin } from "@/lib/role-utils";
import { sanitizeReturnUrl } from "@/lib/return-url";
import { LoadingButton } from "@/components/loading-button";
import { loginFormSchema } from "@/lib/validation-schema";
import { getFieldErrors } from "@/lib/zod-form-errors";

interface UseLoginFormResult {
  email: string;
  password: string;
  error: string;
  fieldErrors: { email?: string; password?: string };
  isLoading: boolean;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

function useLoginForm(): UseLoginFormResult {
  const router = useRouter();
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  const setEmailWithClearError = (newEmail: string) => {
    setEmail(newEmail);
    setError("");
    setFieldErrors((prev) => ({ ...prev, email: undefined }));
  };

  const setPasswordWithClearError = (newPassword: string) => {
    setPassword(newPassword);
    setError("");
    setFieldErrors((prev) => ({ ...prev, password: undefined }));
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedReturnUrl = params.get("returnUrl");
    setReturnUrl(sanitizeReturnUrl(requestedReturnUrl, window.location.origin));
  }, []);

  useEffect(() => {
    if (shouldRedirect && session?.user) {
      if (returnUrl) {
        router.push(returnUrl);
      } else if (isAdmin(session.user)) {
        router.push("/admin");
      } else {
        router.push("/");
      }
      router.refresh();
      setShouldRedirect(false);
    }
  }, [shouldRedirect, session, router, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const validation = loginFormSchema.safeParse({ email, password });
    if (!validation.success) {
      const nextFieldErrors = getFieldErrors(validation.error);
      setFieldErrors({
        email: nextFieldErrors.email,
        password: nextFieldErrors.password,
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.status === 429) {
        setError(data.error || "Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.");
      } else if (response.status === 401) {
        setFieldErrors({ password: data.error || "Ungültige E-Mail oder Passwort" });
      } else if (response.status === 200 && data.success) {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError("Ungültige E-Mail oder Passwort");
        } else if (result?.ok) {
          setShouldRedirect(true);
        } else {
          setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.");
        }
      } else {
        const message = data.error || "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.";
        if (message.includes("E-Mail")) {
          setFieldErrors({ email: message });
        } else if (message.includes("Passwort")) {
          setFieldErrors({ password: message });
        } else {
          setError(message);
        }
      }
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email,
    password,
    error,
    fieldErrors,
    isLoading,
    setEmail: setEmailWithClearError,
    setPassword: setPasswordWithClearError,
    handleSubmit,
  };
}

export default function LoginPage() {
  const { email, password, error, fieldErrors, isLoading, setEmail, setPassword, handleSubmit } = useLoginForm();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="card">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 text-brand-blue-900">
            RAG Schießsport MSE
          </h1>
          <h2 className="text-lg sm:text-xl font-semibold text-center mb-4 sm:mb-6 text-brand-red-700">
            Login
          </h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-3 rounded mb-4 text-base">
              {error}
            </div>
          )}

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
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              />
              {fieldErrors.email && (
                <p id="login-email-error" className="form-help text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Passwort *
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input"
                placeholder="Ihr Passwort"
                disabled={isLoading}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
              />
              {fieldErrors.password && (
                <p id="login-password-error" className="form-help text-red-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <LoadingButton
              type="submit"
              loading={isLoading}
              loadingText="Anmeldung..."
              className="w-full btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
            >
              Anmelden
            </LoadingButton>
          </form>

          <div className="mt-4 text-center text-base">
            <a href="/passwort-vergessen" className="link-primary">
              Passwort vergessen?
            </a>
          </div>

          <div className="mt-6 text-center text-base text-gray-600">
            <p>
              Bei Problemen wenden Sie sich bitte an den{" "}
              <a href="/kontakt" className="link-primary">
                Administrator
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
