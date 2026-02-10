import Link from "next/link";
import { access } from "node:fs/promises";
import path from "node:path";
import { unstable_noStore as noStore } from "next/cache";
import { CalendarIcon, NewsIcon, FileDocumentIcon } from "@/components/icons";
import { prisma } from "@/lib/prisma";
import { getStartOfToday } from "@/lib/date-picker-utils";

const FEATURE_CARDS = [
  {
    href: "/termine",
    icon: <CalendarIcon />,
    title: "Termine",
    description:
      "Informieren Sie sich über anstehende Veranstaltungen, Übungen und Treffen unseres Verbandes.",
  },
  {
    href: "/news",
    icon: <NewsIcon />,
    title: "News",
    description:
      "Bleiben Sie auf dem Laufenden mit den aktuellen Neuigkeiten und Meldungen aus unserem Verband.",
  },
  {
    href: "/info/formulare",
    icon: <FileDocumentIcon />,
    title: "Formulare",
    description:
      "Hier finden Sie alle relevanten Formulare der RAG MSE sowie waffenrechtliche Formulare.",
  },
] as const;

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

function formatEventDate(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

export default async function Home() {
  noStore();
  const [nextEvent, annualPlanning] = await Promise.all([
    getNextEvent(),
    getAnnualPlanningForCurrentYear(),
  ]);

  return (
    <main className="flex-grow">
      <section className="bg-gradient-to-b from-brand-blue-900 to-brand-blue-800 text-white py-8 sm:py-10 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">
            RAG Schießsport MSE
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-4 sm:mb-5 md:mb-6 text-brand-blue-100">
            Willkommen auf der Website der RAG Schießsport MSE
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Link
              href="/ueber-uns"
              className="btn-outline-inverse px-6 sm:px-8 py-3 text-base sm:text-base touch-manipulation"
            >
              Über Uns
            </Link>
            <Link
              href="/kontakt"
              className="btn-primary px-6 sm:px-8 py-3 text-base sm:text-base touch-manipulation"
            >
              Kontakt aufnehmen
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {FEATURE_CARDS.map((card) => (
              <article key={card.href} className="card-elevated group">
                <Link href={card.href} className="block relative">
                  {card.href === "/termine" && (
                    <div className="absolute top-3 right-3 z-10 max-w-[8.5rem] rounded-md border border-brand-blue-200 bg-brand-blue-50 px-2 py-1 text-right text-sm text-brand-blue-900 opacity-50">
                      {nextEvent ? (
                        <>
                          <p className="font-semibold">Nächster Termin:</p>
                          <p>{formatEventDate(nextEvent.date)}</p>
                        </>
                      ) : (
                        <p className="font-semibold">Nächster Termin: -</p>
                      )}
                    </div>
                  )}
                  <div className="text-brand-red-600 mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 group-hover:scale-110 transition-transform">
                      {card.icon}
                    </div>
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 group-hover:text-brand-red-600 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-gray-600 text-base sm:text-base">{card.description}</p>
                </Link>
                {card.href === "/termine" && annualPlanning && (
                  <div className="mt-1">
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
