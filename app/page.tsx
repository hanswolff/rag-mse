export { metadata } from "./metadata";

import Link from "next/link";
import { access } from "node:fs/promises";
import path from "node:path";
import { unstable_noStore as noStore } from "next/cache";
import { getServerSession } from "next-auth";
import {
  CalendarIcon,
  NewsIcon,
  FileDocumentIcon,
  TargetIcon,
} from "@/components/icons";
import { prisma } from "@/lib/prisma";
import { getStartOfToday } from "@/lib/date-picker-utils";
import { authOptions } from "@/lib/auth";
import { canReadMemberDocuments } from "@/lib/role-utils";
import { getNaechsteAktuelleAusschreibung } from "@/lib/ausschreibung-query";
import { appName, appTagline, appDescription } from "@/lib/site-config";
import { serializeJsonLd } from "@/lib/json-ld";

const CORE_FEATURE_CARDS = [
  {
    href: "/termine",
    icon: <CalendarIcon />,
    title: "Termine",
    description:
      "Informieren Sie sich über anstehende Termine, Übungen und Treffen unseres Verbandes.",
  },
  {
    href: "/news",
    icon: <NewsIcon />,
    title: "News",
    description:
      "Bleiben Sie auf dem Laufenden mit den aktuellen News und Meldungen aus unserem Verband.",
  },
] as const;

const FORMULAR_CARD = {
  href: "/info/formulare",
  icon: <FileDocumentIcon />,
  title: "Formulare",
  description:
    "Hier finden Sie alle relevanten Formulare der RAG MSE sowie waffenrechtliche Formulare.",
} as const;

const MEMBER_DOCUMENTS_CARD = {
  href: "/mitglieder-dokumente",
  icon: <FileDocumentIcon />,
  title: "Dokumente für Mitglieder",
  description:
    "Interne Dokumente und Veröffentlichungen für Mitglieder der RAG MSE.",
} as const;

// Solange eine aktuelle Ausschreibung läuft, belegt sie den dritten Kartenplatz —
// für alle Besucher, denn Ausschreibungen sind auch ohne Login öffentlich (CONTEXT.md).
const AUSSCHREIBUNGEN_CARD = {
  href: "/ausschreibungen",
  icon: <TargetIcon />,
  title: "Ausschreibungen",
  description:
    "Aktuelle Ausschreibungen zu Wettkämpfen und Veranstaltungen – mit allen Unterlagen zum Herunterladen.",
} as const;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rag-mse.de";

async function getNextEvent() {
  return prisma.event.findFirst({
    where: {
      visible: true,
      date: { gte: getStartOfToday() },
    },
    orderBy: [{ date: "asc" }, { timeFrom: "asc" }],
    select: {
      date: true,
    },
  });
}

async function getAnnualPlanningForCurrentYear() {
  const year = new Date().getFullYear();
  const fileName = `Jahresplanung${year}.pdf`;
  const filePath = path.join(process.cwd(), "public", "dokumente", fileName);

  try {
    await access(filePath);
    return {
      year,
      href: `/dokumente/${fileName}`,
    };
  } catch {
    return null;
  }
}

function formatCardDate(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

type CardCornerNote = {
  label: string;
  // Fehlt der Wert, steht die Ecke einzeilig als "<Label> -" da (Termine ohne
  // anstehenden Termin). Karten, die ohne Wert gar nicht erscheinen, brauchen das nicht.
  value?: string;
};

// Kleine Ecke oben rechts auf einer Karte ("Nächster Termin", "Nächste
// Ausschreibung"). Welche Karte eine bekommt, entscheidet die Zuordnung in
// Home() — das JSX kennt dafür keine Sonderfälle mehr.
function CardCornerNote({ note }: { note: CardCornerNote | undefined }) {
  if (!note) {
    return null;
  }

  return (
    <div className="absolute top-0 right-0 z-10 max-w-[9rem] rounded-xl border border-brand-blue-200 bg-brand-blue-50/95 px-3 py-2 text-right text-sm text-brand-blue-900 shadow-sm">
      {note.value ? (
        <>
          <p className="font-semibold">{note.label}</p>
          <p>{note.value}</p>
        </>
      ) : (
        <p className="font-semibold">{note.label} -</p>
      )}
    </div>
  );
}

export default async function Home() {
  noStore();
  const session = await getServerSession(authOptions);
  const canShowMemberDocuments = session?.user
    ? canReadMemberDocuments(session.user)
    : false;

  const [nextEvent, annualPlanning, naechsteAusschreibung] = await Promise.all([
    getNextEvent(),
    getAnnualPlanningForCurrentYear(),
    getNaechsteAktuelleAusschreibung(),
  ]);

  const visibleCards = [
    ...CORE_FEATURE_CARDS,
    naechsteAusschreibung
      ? AUSSCHREIBUNGEN_CARD
      : canShowMemberDocuments
        ? MEMBER_DOCUMENTS_CARD
        : FORMULAR_CARD,
  ];

  const cardCornerNotes: Record<string, CardCornerNote | undefined> = {
    "/termine": {
      label: "Nächster Termin:",
      value: nextEvent ? formatCardDate(nextEvent.date) : undefined,
    },
    ...(naechsteAusschreibung
      ? {
          "/ausschreibungen": {
            label: "Nächste Ausschreibung:",
            value: formatCardDate(naechsteAusschreibung.expiresAt),
          },
        }
      : {}),
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: appName,
    logo: `${siteUrl}/og-logo.png`,
    sameAs: ["https://github.com/hanswolff/rag-mse"],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: ["de"],
      url: `${siteUrl}/kontakt`,
    },
  };

  return (
    <main className="flex-grow">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }}
      />
      <section className="hero-pattern overflow-hidden bg-gradient-to-br from-brand-blue-900 via-[#17314A] to-brand-blue-800 pt-4 pb-14 text-white sm:pt-6 sm:pb-14 md:pt-8 md:pb-16 lg:pt-10 lg:pb-18">
        <div className="hero-media" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 text-center sm:px-6 lg:px-8">
          <span className="hero-eyebrow mb-4 hidden sm:inline-flex">
            <TargetIcon className="h-4 w-4" />
            {appTagline}
          </span>
          <h1 className="sr-only sm:not-sr-only sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            {appName}
          </h1>
          <p className="mt-2 sm:mt-4 mx-auto max-w-2xl text-base text-brand-blue-100 sm:text-lg md:text-xl lg:text-2xl">
            {appDescription}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/kontakt"
              className="btn-primary w-full sm:w-auto px-6 sm:px-8 py-3 text-base sm:text-base touch-manipulation"
            >
              Kontakt aufnehmen
            </Link>
            <Link
              href="/ueber-uns"
              className="btn-outline-inverse w-full sm:w-auto px-6 sm:px-8 py-3 text-base sm:text-base touch-manipulation"
            >
              Über Uns
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-8 sm:py-12 section-divider-wave">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
              Entdecken Sie unsere Arbeitsgemeinschaft
            </h2>
            <p className="text-gray-500 mt-2 text-base sm:text-lg max-w-xl mx-auto">
              Informationen, Termine und News
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {visibleCards.map((card) => (
              <article key={card.href} className="card-feature group">
                <Link href={card.href} className="block relative">
                  <CardCornerNote note={cardCornerNotes[card.href]} />
                  <div className="text-brand-red-600 mb-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 p-2.5 sm:p-3 rounded-xl bg-brand-red-50 group-hover:bg-brand-red-100 group-hover:scale-110 transition-all duration-300">
                      {card.icon}
                    </div>
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 group-hover:text-brand-red-600 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-gray-600 text-base sm:text-base">
                    {card.description}
                  </p>
                </Link>
                {card.href === "/termine" && annualPlanning && (
                  <div className="mt-3">
                    <Link
                      href={annualPlanning.href}
                      className="inline-flex items-center font-semibold text-brand-red-700 hover:text-brand-red-800"
                    >
                      Jahresplanung {annualPlanning.year}
                    </Link>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
