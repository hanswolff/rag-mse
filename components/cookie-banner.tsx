"use client";

import { useState } from "react";

const COOKIE_CONSENT_KEY = "cookie-consent";

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(COOKIE_CONSENT_KEY);
  });

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setShowBanner(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-3 sm:p-4 z-overlay shadow-lg"
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-description"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        <p
          id="cookie-banner-description"
          className="text-xs sm:text-sm text-center sm:text-left"
        >
          Wir verwenden Cookies für die Authentifizierung und um Ihnen eine bessere
          Nutzungserfahrung zu bieten. Mit der Nutzung unserer Website stimmen Sie der
          Verwendung von Cookies zu.
        </p>
        <button
          id="cookie-banner-accept"
          onClick={handleAccept}
          className="btn-primary px-4 sm:px-6 py-2 whitespace-nowrap text-base sm:text-base touch-manipulation"
          type="button"
        >
          Akzeptieren
        </button>
      </div>
    </div>
  );
}
