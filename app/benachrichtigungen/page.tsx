"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LoadingButton } from "@/components/loading-button";
import {
  EVENT_REMINDER_DEFAULT_DAYS,
  EVENT_REMINDER_MAX_DAYS,
  EVENT_REMINDER_MIN_DAYS,
} from "@/lib/notification-settings";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";

interface NotificationSettings {
  eventReminderEnabled: boolean;
  eventReminderDaysBefore: number;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settings, setSettings] = useState<NotificationSettings>({
    eventReminderEnabled: true,
    eventReminderDaysBefore: EVENT_REMINDER_DEFAULT_DAYS,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/user/notifications");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Fehler beim Laden der Benachrichtigungseinstellungen");
        }

        setSettings(data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Ein Fehler ist aufgetreten");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchSettings();
  }, [status, router]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/user/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Speichern der Einstellungen");
      }

      setSettings(data);
      setSuccess("Benachrichtigungseinstellungen wurden gespeichert");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Benachrichtigungen</h1>
          <p className="text-gray-600 mt-2">
            Stelle ein, ob und wann du an offene Teilnahmeanmeldungen für Termine erinnert wirst.
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6" noValidate>
            <div className="flex items-start gap-3">
              <input
                id="eventReminderEnabled"
                type="checkbox"
                checked={settings.eventReminderEnabled}
                onChange={(e) => setSettings((prev) => ({ ...prev, eventReminderEnabled: e.target.checked }))}
                disabled={isSaving}
                className="mt-1 h-5 w-5 rounded border-gray-300 text-brand-red-700 focus:ring-brand-red-600"
              />
              <div>
                <label htmlFor="eventReminderEnabled" className="font-semibold text-gray-900">
                  E-Mail-Erinnerung für offene Terminanmeldungen aktivieren
                </label>
                <p className="text-gray-600 mt-1">
                  Du erhältst eine E-Mail, wenn du dich für einen Termin noch nicht mit Ja/Nein/Vielleicht angemeldet hast.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="eventReminderDaysBefore"
                className={`form-label ${settings.eventReminderEnabled ? "text-black" : "text-gray-400"}`}
              >
                Erinnerung senden
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="eventReminderDaysBefore"
                  value={settings.eventReminderDaysBefore}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      eventReminderDaysBefore: Number.parseInt(e.target.value, 10),
                    }))
                  }
                  disabled={isSaving || !settings.eventReminderEnabled}
                  className="form-input max-w-24"
                >
                  {Array.from(
                    { length: EVENT_REMINDER_MAX_DAYS - EVENT_REMINDER_MIN_DAYS + 1 },
                    (_, index) => EVENT_REMINDER_MIN_DAYS + index
                  ).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
                <span className={settings.eventReminderEnabled ? "text-black" : "text-gray-400"}>
                  Tag(e) vor dem Termin
                </span>
              </div>
            </div>

            <LoadingButton
              type="submit"
              loading={isSaving}
              loadingText="Speichern..."
              className="btn-primary"
            >
              Speichern
            </LoadingButton>
          </form>
        </div>
      </div>
    </main>
  );
}
