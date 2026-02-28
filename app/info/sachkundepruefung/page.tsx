import Link from "next/link";
import { DownloadDocumentIcon } from "@/components/icons";

const documents = [
  {
    href: "/dokumente/Fragenkatalog_Sachkundepruefung_ohne_Antworten.pdf",
    label: "Fragenkatalog ohne Antworten (PDF)",
  },
  {
    href: "/dokumente/Fragenkatalog_Sachkundepruefung_mit_Antworten.pdf",
    label: "Fragenkatalog mit Antworten (PDF)",
  },
] as const;

export default function SachkundepruefungPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="card p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
            Fragenkatalog Sachkundeprüfung
          </h1>
          <div className="space-y-4 text-base sm:text-lg text-gray-700 leading-relaxed">
            <p>
              Hier finden Sie die Fragekataloge zur Sachkundeprüfung gemäß § 7 Waffengesetz.
              Für die Vorbereitung steht eine Version ohne Antworten sowie eine Version mit
              Antworten als Lern- und Kontrollhilfe bereit.
            </p>
            <p>
              Nutzen Sie den Katalog ohne Antworten für das eigenständige Üben und den Katalog
              mit Antworten für die anschließende Überprüfung.
            </p>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 pt-2">
              {documents.map((document) => (
                <Link
                  key={document.href}
                  href={document.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary inline-flex items-center justify-center gap-2 text-base"
                >
                  <DownloadDocumentIcon className="w-5 h-5" />
                  {document.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="card mt-6 p-6 sm:p-8 bg-brand-blue-50 border border-brand-blue-100">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
            Rechtliche Orientierung zur Waffenbesitzkarte (WBK)
          </h2>
          <div className="space-y-4 text-base sm:text-lg text-gray-700 leading-relaxed">
            <p>
              Für die Erteilung einer Waffenbesitzkarte sind nach dem Waffengesetz in der Regel
              mehrere Voraussetzungen nachzuweisen. Dazu gehören insbesondere:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Zuverlässigkeit und persönliche Eignung</li>
              <li>nachgewiesene Sachkunde (z. B. bestandene Sachkundeprüfung nach § 7 WaffG)</li>
              <li>ein anerkanntes Bedürfnis (bei Sportschützen über den Verband/Verein)</li>
              <li>Mindestalter und Einhaltung der weiteren gesetzlichen Vorgaben</li>
            </ul>
            <p>
              Für Sportschützen ist regelmäßig eine dokumentierte und andauernde Ausübung des
              Schießsports erforderlich. Welche Nachweise im Einzelfall einzureichen sind, legt
              die zuständige Waffenbehörde fest.
            </p>
            <p className="text-sm sm:text-base text-gray-600">
              Hinweis: Diese Angaben dienen der allgemeinen Orientierung (Stand: Februar 2026)
              und ersetzen keine behördliche oder rechtliche Beratung.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
