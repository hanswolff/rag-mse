"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BackLink } from "@/components/back-link";
import { LoadingButton } from "@/components/loading-button";
import { GermanDatePicker } from "@/components/german-date-picker";
import { ValidatedFieldGroup } from "@/components/validated-field-group";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { mapServerErrorToField, PROFILE_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { profileValidationConfig } from "@/lib/validation-schema";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import { normalizeDateInputValue } from "@/lib/date-picker-utils";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  address: string | null;
  phone: string | null;
  role: string;
  dateOfBirth: string | null;
  rank: string | null;
  pk: string | null;
  reservistsAssociation: string | null;
  associationMemberNumber: string | null;
  hasPossessionCard: boolean;
}

function useProfile() {
  const router = useRouter();
  const { status, update } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const [profileSuccess, setProfileSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    phone: "",
    dateOfBirth: "",
    rank: "",
    pk: "",
    reservistsAssociation: "",
    associationMemberNumber: "",
    hasPossessionCard: false,
  });

  const { errors: validationErrors, validateField, validateAllFields, markFieldAsTouched, shouldShowError, isValidAndTouched } = useFormFieldValidation(profileValidationConfig);

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
        dateOfBirth: normalizeDateInputValue(data.dateOfBirth),
        rank: data.rank || "",
        pk: data.pk || "",
        reservistsAssociation: data.reservistsAssociation || "",
        associationMemberNumber: data.associationMemberNumber || "",
        hasPossessionCard: data.hasPossessionCard || false,
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
    setServerFieldErrors({});
    setProfileSuccess("");

    const fieldValues: Record<string, string> = {
      name: formData.name,
      address: formData.address,
      phone: formData.phone,
      dateOfBirth: formData.dateOfBirth,
      rank: formData.rank,
      pk: formData.pk,
      reservistsAssociation: formData.reservistsAssociation,
      associationMemberNumber: formData.associationMemberNumber,
    };

    const isValid = validateAllFields(fieldValues);
    if (!isValid) {
      setProfileError("Bitte korrigieren Sie die Fehler im Formular");
      return;
    }

    setIsSaving(true);

    try {
      const {
        name,
        address,
        phone,
        dateOfBirth,
        rank,
        pk,
        reservistsAssociation,
        associationMemberNumber,
        hasPossessionCard,
      } = formData;
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          address,
          phone,
          dateOfBirth,
          rank,
          pk,
          reservistsAssociation,
          associationMemberNumber,
          hasPossessionCard,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message = data.error || "Fehler beim Speichern des Profils";
        const fieldErrorMap = mapServerErrorToField(message, PROFILE_FIELD_KEYWORDS);

        if (Object.keys(fieldErrorMap).length > 0) {
          setServerFieldErrors(fieldErrorMap);
        } else {
          setProfileError(message);
        }
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
  }, [formData, validateAllFields, update]);

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
    isValidAndTouched,
    serverFieldErrors,
    setServerFieldErrors,
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
    isValidAndTouched,
    serverFieldErrors,
    setServerFieldErrors,
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
    setServerFieldErrors((prev) => ({ ...prev, [fieldName]: "" }));

    if (validationErrors[fieldName]) {
      validateField(fieldName, value);
    }
  };

  const handleBlur = (fieldName: string, value: string) => {
    markFieldAsTouched(fieldName);
    validateField(fieldName, value);
  };

  const getFieldError = (fieldName: string): string | undefined => {
    if (serverFieldErrors[fieldName]) return serverFieldErrors[fieldName];
    return shouldShowError(fieldName, formData[fieldName as keyof typeof formData] as string)
      ? validationErrors[fieldName]
      : undefined;
  };

  const isFieldValidAndTouched = (fieldName: string): boolean => {
    return isValidAndTouched(fieldName, formData[fieldName as keyof typeof formData] as string);
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

          <form onSubmit={handleSave} className="space-y-4" noValidate>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ValidatedFieldGroup
                label="Name"
                name="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                onBlur={(e) => handleBlur("name", e.target.value)}
                error={getFieldError("name")}
                showSuccess={isFieldValidAndTouched("name")}
                required
                maxLength={100}
                placeholder="Max Mustermann"
                disabled={isSaving}
                autoFocus
              />

              <ValidatedFieldGroup
                label="Dienstgrad"
                name="rank"
                type="text"
                value={formData.rank}
                onChange={(e) => handleInputChange("rank", e.target.value)}
                onBlur={(e) => handleBlur("rank", e.target.value)}
                error={getFieldError("rank")}
                showSuccess={isFieldValidAndTouched("rank")}
                maxLength={30}
                placeholder="z.B. Obergefreiter d.R."
                disabled={isSaving}
              />

              <GermanDatePicker
                id="dateOfBirth"
                label="Geburtsdatum"
                value={formData.dateOfBirth}
                onChange={(date) => handleInputChange("dateOfBirth", date)}
                onBlur={() => handleBlur("dateOfBirth", formData.dateOfBirth)}
                disabled={isSaving}
                error={getFieldError("dateOfBirth")}
                showSuccess={isFieldValidAndTouched("dateOfBirth")}
              />
            </div>

            <ValidatedFieldGroup
              as="textarea"
              label="Adresse"
              name="address"
              value={formData.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
              onBlur={(e) => handleBlur("address", e.target.value)}
              error={getFieldError("address")}
              showSuccess={isFieldValidAndTouched("address")}
              rows={3}
              maxLength={200}
              placeholder="Musterstraße 1&#10;12345 Musterstadt"
              disabled={isSaving}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ValidatedFieldGroup
                label="Telefon"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                onBlur={(e) => handleBlur("phone", e.target.value)}
                error={getFieldError("phone")}
                showSuccess={isFieldValidAndTouched("phone")}
                maxLength={30}
                placeholder="+49 123 456789"
                disabled={isSaving}
              />

              <ValidatedFieldGroup
                label="PK"
                name="pk"
                type="text"
                value={formData.pk}
                onChange={(e) => handleInputChange("pk", e.target.value)}
                onBlur={(e) => handleBlur("pk", e.target.value)}
                error={getFieldError("pk")}
                showSuccess={isFieldValidAndTouched("pk")}
                maxLength={20}
                placeholder="z.B. 12345 A 67890"
                disabled={isSaving}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ValidatedFieldGroup
                label="Reservistenkameradschaft"
                name="reservistsAssociation"
                type="text"
                value={formData.reservistsAssociation}
                onChange={(e) => handleInputChange("reservistsAssociation", e.target.value)}
                onBlur={(e) => handleBlur("reservistsAssociation", e.target.value)}
                error={getFieldError("reservistsAssociation")}
                showSuccess={isFieldValidAndTouched("reservistsAssociation")}
                maxLength={30}
                placeholder="z.B. RK MSE"
                disabled={isSaving}
              />

              <ValidatedFieldGroup
                label="Mitgliedsnummer im Verband"
                name="associationMemberNumber"
                type="text"
                value={formData.associationMemberNumber}
                onChange={(e) => handleInputChange("associationMemberNumber", e.target.value)}
                onBlur={(e) => handleBlur("associationMemberNumber", e.target.value)}
                error={getFieldError("associationMemberNumber")}
                showSuccess={isFieldValidAndTouched("associationMemberNumber")}
                maxLength={30}
                placeholder="z.B. 1234567890"
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="form-label">Waffenbesitzkarte</label>
              <div className="flex items-center gap-3">
                <input
                  id="hasPossessionCard"
                  type="checkbox"
                  checked={formData.hasPossessionCard}
                  onChange={(e) => setFormData({ ...formData, hasPossessionCard: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  disabled={isSaving}
                />
                <label htmlFor="hasPossessionCard" className="text-gray-700 cursor-pointer">
                  Ich besitze eine eigene Waffenbesitzkarte
                </label>
              </div>
            </div>

            <div>
              <LoadingButton
                type="submit"
                loading={isSaving}
                loadingText="Speichern..."
                className="btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation w-auto"
              >
                Speichern
              </LoadingButton>
            </div>
          </form>

          {profile && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-base font-medium text-gray-500">Account-Informationen</h3>
              <dl className="mt-2 space-y-1">
                <div className="flex">
                  <dt className="text-base text-gray-600">Rolle:</dt>
                  <dd className="text-base font-medium text-gray-900 ml-2">
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
