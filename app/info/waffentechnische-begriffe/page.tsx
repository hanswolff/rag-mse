import Link from "next/link";
import { DownloadDocumentIcon } from "@/components/icons";

export default function WaffentechnischeBegriffePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="card p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
            Waffentechnische Begriffe
          </h1>
          <div className="space-y-4 text-base sm:text-lg text-gray-700 leading-relaxed">
            <p>
              Diese Übersicht erläutert wichtige waffentechnische Begriffe in kompakter Form und
              unterstützt beim einheitlichen Verständnis von Aufbau, Funktion und Benennung.
            </p>
            <p>
              Das Dokument eignet sich als Nachschlagewerk für Ausbildung, Einweisung und
              regelmäßige Auffrischung.
            </p>
            <div className="mt-6 text-center">
              <Link
                href="/dokumente/Waffentechnische_Begriffe.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center gap-2 text-base"
              >
                <DownloadDocumentIcon className="w-5 h-5" />
                Waffentechnische Begriffe herunterladen (PDF)
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
