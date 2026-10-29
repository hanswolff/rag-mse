"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordFormSchema } from "@/lib/validation-schema";
import { LoadingButton } from "@/components/loading-button";
import { getFieldErrors } from "@/lib/zod-form-errors";
import { apiFetch, ApiError } from "@/lib/api-fetch";
import { mapServerErrorToField, AUTH_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { PasswordRequirements } from "@/components/password-requirements";
import { ValidatedInput } from "@/components/validated-input";
import { AlertBox } from "@/components/alert-box";
import { AuthCardShell } from "@/components/auth-card-shell";

interface UseResetPasswordFormResult {
  password: string;
  confirmPassword: string;
  message: string;
  error: string;
  fieldErrors: { password?: string; confirmPassword?: string };
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
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [tokenError, setTokenError] = useState("");

  useEffect(() => {
    async function validateToken() {
      try {
        await apiFetch(`/api/auth/reset-password/${token}`, { fallbackError: "Ungültiger Link" });
        setIsValidToken(true);
      } catch (err) {
        setTokenError(err instanceof ApiError ? err.message : "Ein Fehler ist aufgetreten");
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
    setFieldErrors((prev) => ({ ...prev, password: undefined }));
  };

  const setConfirmPasswordWithClear = (newConfirmPassword: string) => {
    setConfirmPassword(newConfirmPassword);
    clearError();
    setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setMessage("");
    setIsLoading(true);

    const validation = resetPasswordFormSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      const nextFieldErrors = getFieldErrors(validation.error);
      setFieldErrors({
        password: nextFieldErrors.password,
        confirmPassword: nextFieldErrors.confirmPassword,
      });
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiFetch<{ message?: string }>(`/api/auth/reset-password/${token}`, {
        method: "POST",
        body: { password },
      });

      setMessage(data.message || "Passwort wurde erfolgreich geändert");
      setIsChanged(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped = mapServerErrorToField(err.message, AUTH_FIELD_KEYWORDS);
        if (mapped.confirmPassword) {
          setFieldErrors({ confirmPassword: mapped.confirmPassword });
        } else if (mapped.password) {
          setFieldErrors({ password: mapped.password });
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
    password,
    confirmPassword,
    message,
    error,
    fieldErrors,
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
    fieldErrors,
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
      <AuthCardShell title="Passwort zurücksetzen">
        <AlertBox type="error" message={tokenError} className="mb-4 text-base" />

        <div className="mt-6 text-center text-base text-gray-600">
          <a href="/passwort-vergessen" className="link-primary">
            Neuen Link anfordern
          </a>
          {" · "}
          <a href="/login" className="link-primary">
            Zum Login
          </a>
        </div>
      </AuthCardShell>
    );
  }

  if (!isValidToken && !tokenError) {
    return (
      <AuthCardShell title="Passwort zurücksetzen">
        <div className="text-center text-gray-700">Wird geladen…</div>
      </AuthCardShell>
    );
  }

  if (isChanged) {
    return (
      <AuthCardShell title="Passwort zurücksetzen">
        <AlertBox type="success" message={message} className="mb-4 text-base" />

        <div className="mt-6 text-center text-base text-gray-600">
          Sie werden automatisch zum Login weitergeleitet…
        </div>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell title="Passwort zurücksetzen">
      <AlertBox type="error" message={error} className="mb-4 text-base" />

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <ValidatedInput
          id="password"
          name="password"
          type="password"
          label="Neues Passwort"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          required
          maxLength={72}
          placeholder="Neues Passwort"
          disabled={isLoading}
          autoFocus
        />

        <ValidatedInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Passwort bestätigen"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={fieldErrors.confirmPassword}
          required
          maxLength={72}
          placeholder="Passwort bestätigen"
          disabled={isLoading}
        />

        <LoadingButton
          type="submit"
          loading={isLoading}
          loadingText="Wird geändert…"
          className="w-full btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
        >
          Passwort ändern
        </LoadingButton>
      </form>

      <div className="mt-6 text-base text-gray-600">
        <p className="font-medium mb-2">Passwort-Anforderungen:</p>
        <PasswordRequirements password={password} />
      </div>

      <div className="mt-6 text-center text-base text-gray-600">
        <a href="/login" className="link-primary">
          Abbrechen und zum Login
        </a>
      </div>
    </AuthCardShell>
  );
}
