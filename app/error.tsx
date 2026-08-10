"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unerwarteter Fehler:", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Es ist ein Fehler aufgetreten</h1>
      <p className="text-gray-600 mb-8">
        Die Seite konnte nicht geladen werden. Bitte versuchen Sie es erneut oder
        kehren Sie zur Startseite zurück.
      </p>
      <div className="flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Erneut versuchen
        </button>
        <Link href="/" className="btn-outline">
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
