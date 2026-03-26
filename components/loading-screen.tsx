"use client";

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({
  message = "Laden...",
  className = "flex flex-1 items-center justify-center",
}: LoadingScreenProps) {
  return (
    <main className={className}>
      <div className="text-gray-600">{message}</div>
    </main>
  );
}
