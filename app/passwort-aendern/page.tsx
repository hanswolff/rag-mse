"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PasswordChangeForm } from "@/components/password-change-form";
import { BackLink } from "@/components/back-link";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { status } = useSession();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isPasswordChanged, setIsPasswordChanged] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    }
  }, [status, router]);

  const handleCurrentPasswordChange = useCallback((value: string) => {
    setPasswordForm((prev) => ({ ...prev, currentPassword: value }));
    setPasswordError("");
  }, []);

  const handleNewPasswordChange = useCallback((value: string) => {
    setPasswordForm((prev) => ({ ...prev, newPassword: value }));
    setPasswordError("");
  }, []);

  const handleConfirmPasswordChange = useCallback((value: string) => {
    setPasswordForm((prev) => ({ ...prev, confirmPassword: value }));
    setPasswordError("");
  }, []);

  const handleChangePassword = useCallback(async () => {
    setPasswordError("");
    setPasswordSuccess("");
    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/user/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setPasswordError(data.error || "Fehler beim Ändern des Passworts");
        return;
      }

      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordSuccess("Passwort wurde erfolgreich geändert");
      setIsPasswordChanged(true);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsChangingPassword(false);
    }
  }, [passwordForm]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Passwort ändern</h1>
          <p className="text-gray-600 mt-2">Aktualisieren Sie Ihr Passwort für Ihr Mitgliederkonto.</p>
        </div>

        {passwordSuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {passwordSuccess}
          </div>
        )}

        {!isPasswordChanged && (
          <PasswordChangeForm
            isChangingPassword={isChangingPassword}
            onSubmit={handleChangePassword}
            currentPassword={passwordForm.currentPassword}
            onCurrentPasswordChange={handleCurrentPasswordChange}
            newPassword={passwordForm.newPassword}
            onNewPasswordChange={handleNewPasswordChange}
            confirmPassword={passwordForm.confirmPassword}
            onConfirmPasswordChange={handleConfirmPasswordChange}
            error={passwordError}
          />
        )}

        <div className="mt-6">
          <BackLink href="/profil" className="text-base">
            Zurück zum Profil
          </BackLink>
        </div>
      </div>
    </main>
  );
}
