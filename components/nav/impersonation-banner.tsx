"use client";

interface ImpersonationBannerProps {
  userName: string;
  impersonatedByName?: string;
  onStop: () => void;
  isStopping: boolean;
  error: string;
}

export function ImpersonationBanner({
  userName,
  impersonatedByName,
  onStop,
  isStopping,
  error,
}: ImpersonationBannerProps) {
  return (
    <div className="bg-amber-100 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-2 sm:py-2.5 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <p className="text-base text-amber-900">
          Impersonierung aktiv: Sie agieren als <strong>{userName || "Benutzer"}</strong>.
          {impersonatedByName ? ` Angemeldet durch ${impersonatedByName}.` : ""}
        </p>
        <button
          type="button"
          onClick={onStop}
          disabled={isStopping}
          className={`px-3 py-2 rounded text-base font-medium touch-manipulation ${
            isStopping
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-amber-700 text-white hover:bg-amber-800"
          }`}
        >
          {isStopping ? "Beenden..." : "Impersonierung beenden"}
        </button>
      </div>
      {error && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-2">
          <p className="text-base text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
