"use client";

import { use, useEffect, useState } from "react";

export default function NotificationUnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const unsubscribe = async () => {
      setIsLoading(true);
      setError("");
      setSuccess("");

      try {
        const response = await fetch(`/api/notifications/unsubscribe/${token}`, {
          method: "POST",
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Deaktivierung nicht möglich");
        }
        setSuccess("Die Benachrichtigung für zukünftige Termine wurde deaktiviert.");
      } catch (unsubscribeError) {
        setError(unsubscribeError instanceof Error ? unsubscribeError.message : "Ein Fehler ist aufgetreten");
      } finally {
        setIsLoading(false);
      }
    };

    void unsubscribe();
  }, [token]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="card text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Benachrichtigungen</h1>
          {isLoading && <p className="text-gray-600">Einstellungen werden aktualisiert...</p>}
          {!isLoading && success && <p className="text-green-700">{success}</p>}
          {!isLoading && error && <p className="text-red-700">{error}</p>}
        </div>
      </div>
    </main>
  );
}
