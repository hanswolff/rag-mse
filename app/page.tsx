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
      <section className="bg-gradient-to-b from-brand-blue-900 to-brand-blue-800 text-white py-12 sm:py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
            RAG Schießsport MSE
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 sm:mb-8 md:mb-10 text-brand-blue-100">
            Willkommen auf der Website der RAG Schießsport MSE
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Link
              href="/termine"
              className="btn-outline-inverse px-6 sm:px-8 py-3 text-base sm:text-base touch-manipulation"
            >
              Aktuelle Termine
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
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-8 sm:mb-10 md:mb-12">
            Unser Angebot
          </h2>
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

      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 md:mb-8">
              Über die RAG Schießsport MSE
            </h2>
            <p className="text-base sm:text-base md:text-lg text-gray-600 mb-4 sm:mb-6 md:mb-8 leading-relaxed">
              Die RAG Schießsport MSE ist eine Reservistenarbeitsgemeinschaft im
              Verband der Reservisten der Deutschen Bundeswehr e. V. in
              Mecklenburg-Vorpommern. Wir sind ein Zusammenschluss
              schießsportinteressierter Verbandsmitglieder aus der Region
              Mecklenburgische Seenplatte.
            </p>
            <p className="text-base sm:text-base md:text-lg text-gray-600 mb-4 sm:mb-6 md:mb-8 leading-relaxed">
              Im Mittelpunkt stehen sportliches Schießen, sichere Waffenhandhabung
              sowie Training und Wettkämpfe nach der Schießsportordnung des
              Verbandes und den waffenrechtlichen Vorgaben. Der Schießsport wird
              dabei als sportlicher Wettbewerb und als Training betrieben;
              Übungen mit militärischem oder polizeilichem Charakter sind im
              schießsportlichen Rahmen ausgeschlossen.
            </p>
            <p className="text-base sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8 md:mb-8 leading-relaxed">
              Wir bieten regelmäßige Schießtermine, Aus- und Fortbildungen sowie
              kameradschaftliche Treffen. Interessierte sind nach vorheriger
              Anmeldung willkommen – werden Sie Teil unserer Gemeinschaft!
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
