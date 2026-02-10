"use client";

import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { getPasswordRequirements } from "@/lib/password-validation";
import { LoadingButton } from "@/components/loading-button";
import { GermanDatePicker } from "@/components/german-date-picker";
import { normalizeDateInputValue } from "@/lib/date-picker-utils";

interface InvitationStatus {
  email: string;
  expiresAt: string;
  name: string;
  address: string;
  phone: string;
  dateOfBirth: string;
  rank: string;
  pk: string;
  hasPossessionCard: boolean;
}

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const { token } = use(params);

  const [status, setStatus] = useState<InvitationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    password: "",
    dateOfBirth: "",
    rank: "",
    pk: "",
    hasPossessionCard: false,
  });

  const passwordRequirements = useMemo(() => getPasswordRequirements(), []);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/invitations/${token}`);
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || "Einladung ungültig");
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
          hasPossessionCard: typeof data.hasPossessionCard === "boolean" ? data.hasPossessionCard : false,
        }));
      } catch {
        setError("Einladung konnte nicht geladen werden");
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
    setError("");
    setSuccess("");
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
        setError(data.error || "Ein Fehler ist aufgetreten");
        return;
      }

      setSuccess("Konto wurde erstellt. Anmeldung wird durchgeführt...");

      const signInResult = await signIn("credentials", {
        email: data.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Anmeldung fehlgeschlagen. Bitte melden Sie sich manuell an.");
        return;
      }

      router.push("/profil");
    } catch {
      setError("Ein Fehler ist aufgetreten");
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
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="card">
          <h1 className="text-2xl font-bold text-brand-blue-900">Einladung annehmen</h1>
          <p className="text-brand-blue-800 mt-2">
            Erstellen Sie Ihr Mitgliedskonto, um Zugriff auf Termine und Neuigkeiten zu erhalten.
          </p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mt-4">
              {success}
            </div>
          )}

          {status && !error && (
            <div className="bg-gray-100 border border-gray-200 text-gray-700 px-4 py-3 rounded mt-4">
              Einladung für: <strong>{status.email}</strong>
            </div>
          )}

          {!error && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <GermanDatePicker
                  id="dateOfBirth"
                  label="Geburtsdatum"
                  value={formData.dateOfBirth}
                  onChange={(date) => setFormData({ ...formData, dateOfBirth: date })}
                  disabled={isSubmitting}
                />
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
                    placeholder="z.B. Oberleutnant"
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
                    placeholder="z.B. 12345"
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

              <div>
                <label htmlFor="password" className="form-label">
                  Passwort *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                  required
                  maxLength={200}
                  className="form-input"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
                <ul className="mt-2 text-base text-gray-600 list-disc list-inside">
                  {passwordRequirements.map((requirement) => (
                    <li key={requirement}>{requirement}</li>
                  ))}
                </ul>
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
