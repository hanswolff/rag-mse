"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BackLink } from "@/components/back-link";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { profileValidationConfig } from "@/lib/validation-schema";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  address: string | null;
  phone: string | null;
  role: string;
}

function useProfile() {
  const router = useRouter();
  const { status, update } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    phone: "",
  });

  const { errors: validationErrors, validateField, markFieldAsTouched, shouldShowError, isFieldValid } = useFormFieldValidation(profileValidationConfig);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (!response.ok) {
        if (response.status === 401) {
          router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
          return;
        }
        throw new Error("Fehler beim Laden des Profils");
      }
      const data = await response.json();
      setProfile(data);
      setFormData({
        name: data.name,
        email: data.email,
        address: data.address || "",
        phone: data.phone || "",
      });
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    } else if (status === "authenticated") {
      fetchProfile();
    }
  }, [status, router, fetchProfile]);

  useEffect(() => {
    if (profileSuccess) {
      const timer = setTimeout(() => setProfileSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [profileSuccess]);

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    validateField("name", formData.name);
    validateField("address", formData.address);
    validateField("phone", formData.phone);

    const isValid =
      isFieldValid("name", formData.name) &&
      isFieldValid("address", formData.address) &&
      isFieldValid("phone", formData.phone);

    if (!isValid) {
      setProfileError("Bitte korrigieren Sie die Fehler im Formular");
      return;
    }

    setIsSaving(true);

    try {
      const { name, address, phone } = formData;
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, address, phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        setProfileError(data.error || "Fehler beim Speichern des Profils");
        return;
      }

      setProfile(data);
      setProfileSuccess("Profil wurde erfolgreich aktualisiert");

      await update({ name });
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsSaving(false);
    }
  }, [formData, validateField, isFieldValid, update]);

  return {
    profile,
    isLoading,
    isSaving,
    profileError,
    profileSuccess,
    formData,
    setFormData,
    handleSave,
    validationErrors,
    validateField,
    markFieldAsTouched,
    shouldShowError,
  };
}

export default function ProfilePage() {
  const {
    profile,
    isLoading,
    isSaving,
    profileError,
    profileSuccess,
    formData,
    setFormData,
    handleSave,
    validationErrors,
    validateField,
    markFieldAsTouched,
    shouldShowError,
  } = useProfile();

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </main>
    );
  }

  const handleInputChange = (fieldName: string, value: string) => {
    setFormData({ ...formData, [fieldName]: value });

    if (validationErrors[fieldName]) {
      validateField(fieldName, value);
    }
  };

  const handleBlur = (fieldName: string, value: string) => {
    markFieldAsTouched(fieldName);
    validateField(fieldName, value);
  };

  const shouldShowFieldError = (fieldName: string, value: string) => {
    return shouldShowError(fieldName, value) ? validationErrors[fieldName] : undefined;
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mein Profil</h1>
          <p className="text-gray-600 mt-2">Verwalten Sie Ihre persönlichen Daten</p>
        </div>

        <div className="space-y-6">
          <div className="card">
          {profileError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {profileError}
            </div>
          )}

          {profileSuccess && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {profileSuccess}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6" noValidate>
            <div>
              <label htmlFor="name" className="form-label">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                onBlur={(e) => handleBlur("name", e.target.value)}
                maxLength={100}
                className={`form-input ${
                  shouldShowFieldError("name", formData.name) ? "border-red-500 focus:border-red-500" : ""
                }`}
                placeholder="Max Mustermann"
                disabled={isSaving}
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
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="form-input bg-gray-100"
                placeholder="beispiel@email.de"
              />
            </div>

            <div>
              <label htmlFor="address" className="form-label">
                Adresse
              </label>
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                onBlur={(e) => handleBlur("address", e.target.value)}
                rows={3}
                maxLength={200}
                className={`form-textarea ${
                  shouldShowFieldError("address", formData.address) ? "border-red-500 focus:border-red-500" : ""
                }`}
                placeholder="Musterstraße 1&#10;12345 Musterstadt"
                disabled={isSaving}
                aria-invalid={!!shouldShowFieldError("address", formData.address)}
              />
              {shouldShowFieldError("address", formData.address) && (
                <p className="form-help text-red-600">
                  {validationErrors.address}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="form-label">
                Telefon
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                onBlur={(e) => handleBlur("phone", e.target.value)}
                maxLength={30}
                className={`form-input ${
                  shouldShowFieldError("phone", formData.phone) ? "border-red-500 focus:border-red-500" : ""
                }`}
                placeholder="+49 123 456789"
                disabled={isSaving}
                aria-invalid={!!shouldShowFieldError("phone", formData.phone)}
              />
              {shouldShowFieldError("phone", formData.phone) && (
                <p className="form-help text-red-600">
                  {validationErrors.phone}
                </p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation w-auto"
              >
                {isSaving ? "Speichern..." : "Speichern"}
              </button>
            </div>
          </form>

          {profile && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-base font-medium text-gray-500">Account-Informationen</h3>
              <dl className="mt-2 space-y-1">
                <div className="flex justify-between">
                  <dt className="text-base text-gray-600">Rolle:</dt>
                  <dd className="text-base font-medium text-gray-900">
                    {profile.role === "ADMIN" ? "Administrator" : "Mitglied"}
                  </dd>
                </div>
              </dl>
            </div>
          )}
          </div>

        </div>

        <div className="mt-6 text-center">
          <BackLink href="/" className="text-base">
            Zurück zur Startseite
          </BackLink>
        </div>
      </div>
    </main>
  );
}
