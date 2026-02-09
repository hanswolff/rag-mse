import Link from "next/link";
import { CalendarIcon, NewsIcon, MailIcon } from "@/components/icons";

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
    href: "/kontakt",
    icon: <MailIcon />,
    title: "Kontakt",
    description:
      "Haben Sie Fragen? Schreiben Sie uns über unser Kontaktformular oder kontaktieren Sie uns direkt.",
  },
] as const;

export default function Home() {
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
              <Link
                key={card.href}
                href={card.href}
                className="card-elevated group"
              >
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
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
