"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { LoadingButton } from "@/components/loading-button";
import { LoadingScreen } from "@/components/loading-screen";
import { ProfileFieldsFieldset, useProfileFormFields } from "@/components/profile-fields-fieldset";
import { API_ROUTES } from "@/lib/api-routes";
import { mapServerErrorToField, PROFILE_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import { normalizeDateInputValue } from "@/lib/date-picker-utils";
import { Permissions } from "@/lib/permissions";
import { useProtectedPage } from "@/lib/use-protected-page";
import { AlertBox } from "@/components/alert-box";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

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
  const { status, update } = useProtectedPage();
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
    dateOfBirth: "",
    rank: "",
    pk: "",
    reservistsAssociation: "",
    associationMemberNumber: "",
    hasPossessionCard: false,
  });

  const {
    setServerFieldErrors,
    setFieldValue,
    handleFieldBlur,
    getFieldError,
    isFieldValidAndTouched,
    validateAllFields,
  } = useProfileFormFields(formData, setFormData);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetchWithTimeout(API_ROUTES.USER.PROFILE);
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
    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status, fetchProfile]);

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
      const response = await fetchWithTimeout(API_ROUTES.USER.PROFILE, {
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
        const fieldErrorMap = mapServerErrorToField(message, PROFILE_FIELD_KEYWORDS, data.fieldErrors);

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
  }, [formData, validateAllFields, setServerFieldErrors, update]);

  return {
    profile,
    isLoading,
    isSaving,
    profileError,
    profileSuccess,
    formData,
    setFormData,
    handleSave,
    setFieldValue,
    handleFieldBlur,
    getFieldError,
    isFieldValidAndTouched,
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
    setFieldValue,
    handleFieldBlur,
    getFieldError,
    isFieldValidAndTouched,
  } = useProfile();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mein Profil</h1>
          <p className="text-gray-600 mt-2">Verwalten Sie Ihre persönlichen Daten</p>
        </div>

        <div className="space-y-6">
          <div className="card">
          <AlertBox type="error" message={profileError} className="mb-4" />

          <AlertBox type="success" message={profileSuccess} className="mb-4" />

          <form onSubmit={handleSave} className="space-y-4" noValidate>
            <ProfileFieldsFieldset
              formData={formData}
              disabled={isSaving}
              onFieldChange={setFieldValue}
              onFieldBlur={handleFieldBlur}
              onHasPossessionCardChange={(checked) =>
                setFormData((current) => ({ ...current, hasPossessionCard: checked }))
              }
              getFieldError={getFieldError}
              isValidAndTouched={isFieldValidAndTouched}
              emailSlot={
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
              }
            />

            <div>
              <LoadingButton
                type="submit"
                loading={isSaving}
                loadingText="Speichern…"
                className="btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation w-auto"
              >
                Speichern
              </LoadingButton>
            </div>
          </form>

          {profile && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-base font-medium text-gray-500">Konto-Informationen</h3>
              <dl className="mt-2 space-y-1">
                <div className="flex">
                  <dt className="text-base text-gray-600">Rolle:</dt>
                  <dd className="text-base font-medium text-gray-900 ml-2">
                    {Permissions.getRoleLabel(profile.role)}
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
