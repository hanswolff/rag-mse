import Link from "next/link";

const INFO_LINKS = [
  {
    href: "/info/schiesssportordnung",
    title: "Schießsportordnung",
    description: "Regelwerk, Disziplinen und Download der aktuellen Sportordnung.",
  },
  {
    href: "/info/leitfaden-waffenteile",
    title: "Leitfaden Waffenteile",
    description: "Übersicht zu waffenrechtlichen Einstufungen und offiziellen Quellen.",
  },
  {
    href: "/info/waffentechnische-begriffe",
    title: "Waffentechnische Begriffe",
    description: "Nachschlagewerk für zentrale technische Begriffe.",
  },
  {
    href: "/info/sachkundepruefung",
    title: "Sachkundeprüfung",
    description: "Fragenkataloge und Hinweise zur Vorbereitung.",
  },
  {
    href: "/info/sicherheitsbelehrung",
    title: "Sicherheitsbelehrung",
    description: "Wichtige Hinweise für einen sicheren Ablauf auf dem Schießstand.",
  },
  {
    href: "/info/formulare",
    title: "Formulare",
    description: "Schnellzugriff auf relevante RAG- und waffenrechtliche Formulare.",
  },
] as const;

export default function InfoPage() {
  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="card p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">Infos</h1>
          <p className="text-base sm:text-lg text-gray-700 mb-6">
            Öffentliche Informationen, Leitfäden und Dokumente der RAG Schießsport MSE.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INFO_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-lg border border-gray-200 bg-white p-4 hover:border-brand-red-300 hover:shadow-sm transition-colors">
                <h2 className="text-lg font-semibold text-gray-900">{item.title}</h2>
                <p className="mt-2 text-sm sm:text-base text-gray-600">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
