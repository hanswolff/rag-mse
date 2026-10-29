"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Permissions } from "@/lib/permissions";
import { LoadingScreen } from "@/components/loading-screen";
import { appName } from "@/lib/site-config";

const DASHBOARD_CARDS = [
  {
    href: "/admin/benutzerverwaltung",
    icon: "👥",
    title: "Benutzerverwaltung",
    description: "Verwalten Sie Benutzer, senden Sie Einladungen und erstellen Sie neue Konten.",
  },
  {
    href: "/admin/termine",
    icon: "📅",
    title: "Termine",
    description: "Erstellen, bearbeiten und verwalten Sie Trainingstermine und Wettkämpfe.",
  },
  {
    href: "/admin/fremdtermine",
    icon: "🗓️",
    title: "Fremdtermine",
    description: "Pflegen Sie Fremdtermine wie RDL, RK-Veranstaltungen und externe Wettkämpfe.",
  },
  {
    href: "/admin/umfragen",
    icon: "📊",
    title: "Umfragen",
    description: "Erstellen und verwalten Sie Umfragen für Mitglieder.",
  },
  {
    href: "/admin/news",
    icon: "📰",
    title: "News",
    description: "Veröffentlichen und verwalten Sie News und Ankündigungen.",
  },
  {
    href: "/admin/standorte",
    icon: "📍",
    title: "Standorte",
    description: "Verwalten Sie Standorte und deren Adressdaten.",
  },
  {
    href: "/admin/ausschreibungen",
    icon: "📢",
    title: "Ausschreibungen",
    description: "Verwalten Sie Ausschreibungen inklusive PDF-Upload, Bearbeiten und Löschen.",
  },
  {
    href: "/admin/dokumente",
    icon: "📄",
    title: "Admin-Dokumente",
    description: "Verwalten Sie Admin-Dokumente inklusive Upload, Vorschau, Download und Umbenennung.",
  },
  {
    href: "/admin/mitglied-dokumente",
    icon: "📁",
    title: "Dokumente für Mitglieder",
    description: "Verwalten Sie Dokumente für Mitglieder inklusive Upload, Vorschau, Download und Umbenennung.",
  },
  {
    href: "/admin/benachrichtigungen",
    icon: "🔔",
    title: "Benachrichtigungen",
    description: "Sehen Sie die versendeten Termin-Erinnerungen und Umfrage-Benachrichtigungen der letzten 30 Tage.",
    requires: "canReadNotificationsAdmin",
  },
  {
    href: "/admin/e-mail-versand",
    icon: "✉️",
    title: "E-Mail-Versand",
    description: "Überwachen Sie den Postausgang, suchen Sie Metadaten und planen Sie fehlgeschlagene E-Mails neu ein.",
    requires: "canReadOutgoingEmails",
  },
] as const;

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const cardVisibility = {
    canReadNotificationsAdmin: Permissions.canReadNotificationsAdmin(session?.user),
    canReadOutgoingEmails: Permissions.canReadOutgoingEmails(session?.user),
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (status === "loading") {
    return <LoadingScreen />;
  }

  const visibleCards = DASHBOARD_CARDS.filter((card) => !("requires" in card) || cardVisibility[card.requires]);

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Adminbereich Dashboard</h1>
          <p className="text-base sm:text-base text-gray-600 mt-2">Willkommen im Administrationsbereich der {appName}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl sm:text-3xl">{card.icon}</span>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{card.title}</h2>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
