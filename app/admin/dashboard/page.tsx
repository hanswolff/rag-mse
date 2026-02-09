"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isAdmin } from "@/lib/role-utils";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import Link from "next/link";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    } else if (status === "authenticated" && !isAdmin(session.user)) {
      router.push("/");
    }
  }, [status, session, router]);

  // Force scroll to top on mount to prevent scroll bar jumping to bottom
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Adminbereich Dashboard</h1>
          <p className="text-base sm:text-base text-gray-600 mt-2">Willkommen im Administrationsbereich der RAG Schießsport MSE</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/admin/benutzerverwaltung"
            className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl sm:text-3xl">👥</span>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Benutzerverwaltung</h2>
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              Verwalten Sie Benutzer, senden Sie Einladungen und erstellen Sie neue Konten.
            </p>
          </Link>

          <Link
            href="/admin/termine"
            className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl sm:text-3xl">📅</span>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Termine</h2>
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              Erstellen, bearbeiten und verwalten Sie Trainingstermine und Wettkämpfe.
            </p>
          </Link>

          <Link
            href="/admin/news"
            className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl sm:text-3xl">📰</span>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">News</h2>
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              Veröffentlichen und verwalten Sie Neuigkeiten und Ankündigungen.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
