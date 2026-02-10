"use client";

import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { getPasswordRequirements, validatePassword } from "@/lib/password-validation";
import { LoadingButton } from "@/components/loading-button";
import { GermanDatePicker } from "@/components/german-date-picker";
import { normalizeDateInputValue } from "@/lib/date-picker-utils";

interface InvitationStatus {
  email: string;
  role: "ADMIN" | "MEMBER";
  expiresAt: string;
  name: string;
  address: string;
  phone: string;
  memberSince: string;
  dateOfBirth: string;
  rank: string;
  pk: string;
  reservistsAssociation: string;
  associationMemberNumber: string;
  hasPossessionCard: boolean;
}

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const { token } = use(params);

  const [status, setStatus] = useState<InvitationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fatalError, setFatalError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordServerErrors, setPasswordServerErrors] = useState<string[]>([]);
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    password: "",
    confirmPassword: "",
    dateOfBirth: "",
    rank: "",
    pk: "",
    reservistsAssociation: "",
    associationMemberNumber: "",
    hasPossessionCard: false,
  });

  const passwordRequirements = useMemo(() => getPasswordRequirements(), []);
  const passwordValidation = useMemo(() => validatePassword(formData.password), [formData.password]);
  const passwordErrors = [...passwordValidation.errors, ...passwordServerErrors];
  const hasPasswordMismatch = formData.password !== formData.confirmPassword;
  const showPasswordErrors = showPasswordValidation || formData.password.length > 0;
  const showConfirmPasswordError = (showPasswordValidation || formData.confirmPassword.length > 0) && hasPasswordMismatch;

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/invitations/${token}`);
        const data = await response.json();
        if (!response.ok) {
          setFatalError(data.error || "Einladung ungültig");
          return;
        }
        setStatus(data);
        setFormData((current) => ({
          ...current,
          name: typeof data.name === "string" ? data.name : "",
          address: typeof data.address === "string" ? data.address : "",
          phone: typeof data.phone === "string" ? data.phone : "",
          dateOfBirth: normalizeDateInputValue(typeof data.dateOfBirth === "string" ? data.dateOfBirth : ""),
          rank: typeof data.rank === "string" ? data.rank : "",
          pk: typeof data.pk === "string" ? data.pk : "",
          reservistsAssociation: typeof data.reservistsAssociation === "string" ? data.reservistsAssociation : "",
          associationMemberNumber: typeof data.associationMemberNumber === "string" ? data.associationMemberNumber : "",
          hasPossessionCard: typeof data.hasPossessionCard === "boolean" ? data.hasPossessionCard : false,
        }));
      } catch {
        setFatalError("Einladung konnte nicht geladen werden");
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchStatus();
    }
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setShowPasswordValidation(true);
    setFormError("");
    setPasswordServerErrors([]);
    setConfirmPasswordError("");
    setSuccess("");

    if (!passwordValidation.isValid) {
      return;
    }

    if (hasPasswordMismatch) {
      setConfirmPasswordError("Passwörter stimmen nicht überein");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        const message = data.error || "Ein Fehler ist aufgetreten";
        if (response.status === 404 || response.status === 410) {
          setFatalError(message);
          return;
        }
        if (message === "Passwörter stimmen nicht überein") {
          setConfirmPasswordError(message);
          return;
        }
        if (message.includes("Passwort muss") || message.includes("Passwort darf")) {
          setPasswordServerErrors(message.split(". ").filter((entry: string) => entry.trim().length > 0));
          return;
        }
        setFormError(message);
        return;
      }

      setSuccess("Konto wurde erstellt. Anmeldung wird durchgeführt...");

      const signInResult = await signIn("credentials", {
        email: data.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.error) {
        setFormError("Anmeldung fehlgeschlagen. Bitte melden Sie sich manuell an.");
        return;
      }

      router.push("/profil");
    } catch {
      setFormError("Ein Fehler ist aufgetreten");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Einladung wird geladen...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="card">
          <h1 className="text-2xl font-bold text-brand-blue-900">Einladung annehmen</h1>
          <p className="text-brand-blue-800 mt-2">
            Erstellen Sie Ihr Mitgliedskonto, um Zugriff auf Termine und Neuigkeiten zu erhalten.
          </p>

          {fatalError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
              {fatalError}
            </div>
          )}

          {formError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
              {formError}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mt-4">
              {success}
            </div>
          )}

          {status && (
            <div className="bg-gray-100 border border-gray-200 text-gray-700 px-4 py-3 rounded mt-4">
              Einladung für: <strong>{status.email}</strong>
            </div>
          )}

          {status && !fatalError && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="form-label">
                    Name *
                  </label>
                  <input
                    id="name"
                    name="fullName"
                    type="text"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    required
                    maxLength={100}
                    className="form-input"
                    autoComplete="name"
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>

                <GermanDatePicker
                  id="dateOfBirth"
                  label="Geburtsdatum"
                  value={formData.dateOfBirth}
                  onChange={(date) => setFormData({ ...formData, dateOfBirth: date })}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label htmlFor="address" className="form-label">
                  Adresse
                </label>
                <input
                  id="address"
                  name="streetAddress"
                  type="text"
                  value={formData.address}
                  onChange={(event) => setFormData({ ...formData, address: event.target.value })}
                  maxLength={200}
                  className="form-input"
                  placeholder="Musterstraße 1, 12345 Musterstadt"
                  autoComplete="street-address"
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="form-label">
                    E-Mail *
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={status?.email ?? ""}
                    readOnly
                    required
                    className="form-input bg-gray-100 text-gray-700 cursor-not-allowed"
                    autoComplete="username"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="form-label">
                    Telefon
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                    maxLength={30}
                    className="form-input"
                    placeholder="0123 456789"
                    autoComplete="tel"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rank" className="form-label">
                    Dienstgrad
                  </label>
                  <input
                    id="rank"
                    name="rank"
                    type="text"
                    value={formData.rank}
                    onChange={(event) => setFormData({ ...formData, rank: event.target.value })}
                    maxLength={30}
                    className="form-input"
                    placeholder="z.B. Obergefreiter d.R."
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="pk" className="form-label">
                    PK
                  </label>
                  <input
                    id="pk"
                    name="pk"
                    type="text"
                    value={formData.pk}
                    onChange={(event) => setFormData({ ...formData, pk: event.target.value })}
                    maxLength={20}
                    className="form-input"
                    placeholder="z.B. 12345 A 67890"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reservistsAssociation" className="form-label">
                    Reservistenkameradschaft
                  </label>
                  <input
                    id="reservistsAssociation"
                    name="reservistsAssociation"
                    type="text"
                    value={formData.reservistsAssociation}
                    onChange={(event) => setFormData({ ...formData, reservistsAssociation: event.target.value })}
                    maxLength={30}
                    className="form-input"
                    placeholder="z.B. RK MSE"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="associationMemberNumber" className="form-label">
                    Mitgliedsnummer im Verband
                  </label>
                  <input
                    id="associationMemberNumber"
                    name="associationMemberNumber"
                    type="text"
                    value={formData.associationMemberNumber}
                    onChange={(event) => setFormData({ ...formData, associationMemberNumber: event.target.value })}
                    maxLength={30}
                    className="form-input"
                    placeholder="z.B. 1234567890"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Waffenbesitzkarte</label>
                <div className="flex items-center gap-3">
                  <input
                    id="hasPossessionCard"
                    name="hasPossessionCard"
                    type="checkbox"
                    checked={formData.hasPossessionCard}
                    onChange={(event) => setFormData({ ...formData, hasPossessionCard: event.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <label htmlFor="hasPossessionCard" className="text-gray-700 cursor-pointer">
                    Ich besitze eine eigene Waffenbesitzkarte
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="password" className="form-label">
                  Passwort *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={(event) => {
                    setFormData({ ...formData, password: event.target.value });
                    setPasswordServerErrors([]);
                    setConfirmPasswordError("");
                  }}
                  required
                  maxLength={200}
                  className="form-input"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
                {showPasswordErrors && passwordErrors.length > 0 && (
                  <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                    {passwordErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
                <ul className="mt-2 text-base text-gray-600 list-disc list-inside">
                  {passwordRequirements.map((requirement) => (
                    <li key={requirement}>{requirement}</li>
                  ))}
                </ul>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="form-label">
                  Passwort wiederholen *
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(event) => {
                    setFormData({ ...formData, confirmPassword: event.target.value });
                    setConfirmPasswordError("");
                  }}
                  required
                  maxLength={200}
                  className="form-input"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
                {(confirmPasswordError || showConfirmPasswordError) && (
                  <p className="mt-2 text-sm text-red-700">
                    {confirmPasswordError || "Passwörter stimmen nicht überein"}
                  </p>
                )}
              </div>

              <LoadingButton
                type="submit"
                loading={isSubmitting}
                loadingText="Wird erstellt..."
                className="w-full btn-primary py-2"
              >
                Konto erstellen
              </LoadingButton>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
