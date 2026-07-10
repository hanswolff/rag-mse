"use client";

import { useEffect, useState, useCallback } from "react";
import { LoadingButton } from "@/components/loading-button";
import { LoadingScreen } from "@/components/loading-screen";
import {
  EVENT_REMINDER_DEFAULT_DAYS,
  EVENT_REMINDER_MAX_DAYS,
  EVENT_REMINDER_MIN_DAYS,
} from "@/lib/notification-settings";
import { API_ROUTES } from "@/lib/api-routes";
import { useProtectedPage } from "@/lib/use-protected-page";
import { AlertBox } from "@/components/alert-box";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

interface NotificationSettings {
  eventReminderEnabled: boolean;
  eventReminderDaysBefore: number;
  pollNotificationEnabled: boolean;
}

export default function NotificationsPage() {
  const { status } = useProtectedPage();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settings, setSettings] = useState<NotificationSettings>({
    eventReminderEnabled: true,
    eventReminderDaysBefore: EVENT_REMINDER_DEFAULT_DAYS,
    pollNotificationEnabled: true,
  });

  const fetchSettings = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetchWithTimeout(API_ROUTES.USER.NOTIFICATIONS, { signal });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Laden der Benachrichtigungseinstellungen");
      }
      const data = await response.json();
      setSettings(data);
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
      setError(fetchError instanceof Error ? fetchError.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    void fetchSettings(controller.signal);
    return () => controller.abort();
  }, [status, fetchSettings]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetchWithTimeout(API_ROUTES.USER.NOTIFICATIONS, {
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
    return <LoadingScreen />;
  }

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Benachrichtigungen</h1>
          <p className="text-gray-600 mt-2">
            Stellen Sie ein, welche E-Mail-Benachrichtigungen Sie erhalten möchten.
          </p>
        </div>

        <div className="card">
          <AlertBox type="error" message={error} className="mb-4" />

          <AlertBox type="success" message={success} className="mb-4" />

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
                  E-Mail-Erinnerung für offene Teilnahmeanmeldungen aktivieren
                </label>
                <p className="text-gray-600 mt-1">
                  Sie erhalten eine E-Mail, wenn Sie sich für einen Termin noch nicht mit Ja/Nein/Vielleicht angemeldet haben.
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

            <hr className="border-gray-200" />

            <div className="flex items-start gap-3">
              <input
                id="pollNotificationEnabled"
                type="checkbox"
                checked={settings.pollNotificationEnabled}
                onChange={(e) => setSettings((prev) => ({ ...prev, pollNotificationEnabled: e.target.checked }))}
                disabled={isSaving}
                className="mt-1 h-5 w-5 rounded border-gray-300 text-brand-red-700 focus:ring-brand-red-600"
              />
              <div>
                <label htmlFor="pollNotificationEnabled" className="font-semibold text-gray-900">
                  E-Mail-Benachrichtigung bei neuen Umfragen
                </label>
                <p className="text-gray-600 mt-1">
                  Sie erhalten eine E-Mail, wenn eine neue Umfrage veröffentlicht wird.
                </p>
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
