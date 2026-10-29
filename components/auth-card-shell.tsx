import type { ReactNode } from "react";
import { appName } from "@/lib/site-config";

// Kartenkopf der Auth-Seiten: Vereinsname + Seitentitel.
export function AuthCardHeading({ title }: { title: string }) {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 text-brand-blue-900">
        {appName}
      </h1>
      <h2 className="text-lg sm:text-xl font-semibold text-center mb-4 sm:mb-6 text-brand-red-700">
        {title}
      </h2>
    </>
  );
}

// Zentrierte Auth-Karte (Passwort vergessen / zurücksetzen). Der Login nutzt
// wegen seines Split-Layouts nur den AuthCardHeading.
export function AuthCardShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="card">
          <AuthCardHeading title={title} />
          {children}
        </div>
      </div>
    </main>
  );
}
