import Link from "next/link";
import { DownloadDocumentIcon, ExternalLinkIcon } from "@/components/icons";

export default function LeitfadenWaffenteilePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="card p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
            Leitfaden Waffenteile
          </h1>
          <div className="space-y-4 text-base sm:text-lg text-gray-700 leading-relaxed">
            <p>
              Mit der Änderung des Waffengesetzes vom 19.02.2020 ändern sich die rechtlichen
              Einstufungen von bestimmten Bauteilen bei Schusswaffen.
            </p>
            <p>
              Der Leitfaden des Bundeskriminalamtes beschreibt diese Änderungen detailliert und
              stellt sie anhand von umfassenden Bildbeispielen dar. Er bietet eine verlässliche
              Orientierungshilfe für alle Schützen und Waffenbesitzer im Umgang mit den neuen
              gesetzlichen Bestimmungen.
            </p>
            <p>
              Das Dokument enthält:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Übersicht über die Änderungen im Waffengesetz</li>
              <li>Detaillierte Darstellung der betroffenen Bauteile</li>
              <li>Fotodokumentation der wesentlichen Waffenteile</li>
              <li>Praktische Hinweise zur Umsetzung</li>
            </ul>
            <div className="mt-6 text-center">
              <Link
                href="/dokumente/LeitfadenWaffenteile_DE.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center gap-2 text-base"
              >
                <DownloadDocumentIcon className="w-5 h-5" />
                Leitfaden herunterladen (PDF)
              </Link>
            </div>
          </div>
        </section>
        <section className="card mt-6 p-6 sm:p-8 bg-brand-blue-50 border border-brand-blue-100">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
            Nationales Waffenregister
          </h2>
          <div className="space-y-4 text-base sm:text-lg text-gray-700 leading-relaxed">
            <p>
              Weitere offizielle Informationen zum Nationalen Waffenregister (NWR)
              stellt das Bundesministerium des Innern und für Heimat bereit.
              Dort finden Sie Hintergründe, Zuständigkeiten und aktuelle Hinweise
              zum Register.
            </p>
            <div className="mt-6">
              <Link
                href="https://www.bmi.bund.de/DE/themen/sicherheit/waffen/das-nationale-waffenregister/das-nationale-waffenregister-node.html"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2 text-base"
              >
                <ExternalLinkIcon className="w-5 h-5" />
                Informationsseite Nationales Waffenregister (BMI)
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
