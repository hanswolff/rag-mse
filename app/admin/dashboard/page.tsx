"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Permissions } from "@/lib/permissions";
import { LoadingScreen } from "@/components/loading-screen";
import { appName } from "@/lib/site-config";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const canReadNotificationsAdmin = Permissions.canReadNotificationsAdmin(session?.user);
  const canReadOutgoingEmails = Permissions.canReadOutgoingEmails(session?.user);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (status === "loading") {
    return <LoadingScreen />;
  }

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Adminbereich Dashboard</h1>
          <p className="text-base sm:text-base text-gray-600 mt-2">Willkommen im Administrationsbereich der {appName}</p>
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
            href="/admin/umfragen"
            className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl sm:text-3xl">📊</span>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Umfragen</h2>
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              Erstellen und verwalten Sie Umfragen für Mitglieder.
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

          <Link
            href="/admin/standorte"
            className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl sm:text-3xl">📍</span>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Standorte</h2>
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              Verwalten Sie Schießstände und deren Adressdaten.
            </p>
          </Link>

          <Link
            href="/admin/ausschreibungen"
            className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl sm:text-3xl">📢</span>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Ausschreibungen</h2>
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              Verwalten Sie öffentliche Ausschreibungen inklusive PDF-Upload, Bearbeiten und Löschen.
            </p>
          </Link>

          <Link
            href="/admin/dokumente"
            className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl sm:text-3xl">📄</span>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Admin-Dokumente</h2>
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              Verwalten Sie Admin-Dokumente inklusive Upload, Vorschau, Download und Umbenennung.
            </p>
          </Link>

          <Link
            href="/admin/mitglied-dokumente"
            className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl sm:text-3xl">📁</span>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Dokumente für Mitglieder</h2>
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              Verwalten Sie Dokumente für Mitglieder inklusive Upload, Vorschau, Download und Umbenennung.
            </p>
          </Link>

          {canReadNotificationsAdmin && (
            <Link
              href="/admin/benachrichtigungen"
              className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl sm:text-3xl">🔔</span>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Benachrichtigungen</h2>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Sehen Sie die zuletzt versendeten Termin-Benachrichtigungen der letzten 30 Tage.
              </p>
            </Link>
          )}

          {canReadOutgoingEmails && (
            <Link
              href="/admin/e-mail-versand"
              className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl sm:text-3xl">✉️</span>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">E-Mail-Versand</h2>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Überwachen Sie Outbox-E-Mails, suchen Sie Metadaten und planen Sie fehlgeschlagene E-Mails neu ein.
              </p>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
