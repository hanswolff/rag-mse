import Link from "next/link";
import { DownloadDocumentIcon } from "@/components/icons";

export default function SicherheitsbelehrungPage() {
  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="card p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
            Sicherheitsbelehrung
          </h1>
          <div className="space-y-4 text-base sm:text-lg text-gray-700 leading-relaxed">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-6 mb-3">
              Verpflichtung zur Sicherheitsbelehrung
            </h2>
            <p>
              Alle Mitglieder einer RAG-Schießsport sind laut Geschäftsordnung (§ 4 Abs. 3 d) verpflichtet:
            </p>
            <blockquote className="border-l-4 border-brand-red-600 pl-4 my-4 italic text-gray-600">
              &ldquo;mindestens einmal jährlich an einer Sicherheitsbelehrung teilzunehmen&rdquo;
            </blockquote>
            <p>
              Diese Belehrung kann von allen geprüften Schießleitern vorgenommen werden und wird durch einen Eintrag im Schießbuch <strong>&ldquo;Sicherheitsbelehrung&rdquo;</strong> (inkl. Datum und Unterschrift) beglaubigt.
            </p>

            <hr className="my-6 border-gray-300" />

            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-6 mb-3">
              Besondere Schwerpunkte der Sicherheitsbelehrung
            </h2>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Aufbewahrungsvorschriften</li>
              <li>Transport von Waffen und Munition</li>
              <li>Waffenbesitzkarten für alle mitgeführten Waffen</li>
              <li>Unzulässige Waffen oder Munition</li>
              <li>Lagerort des Erste-Hilfe-Kastens / Ersthelfer / Notruf</li>
              <li>Ladezustand der Waffe bei Übergabe oder Übernahme</li>
              <li>
                Benutzungspflicht von Gehörschutz beim Schießen sowie Trage- und Verwendungspflicht von taktischen Brillen bzw. Schutzbrillen mit Seitenschutz beim Kurzwaffenschießen
              </li>
              <li>Kommandos der Aufsichten</li>
              <li>Regelungen zur Trefferaufnahme</li>
              <li>Waffenablage (offener Verschluss, Mündung in Richtung Ziel)</li>
              <li>Keine Zielübungen hinter Schützen, auch wenn die Waffe ungeladen ist</li>
              <li>Umgang mit Waffenstörungen</li>
              <li>Nachladen nur nach Aufforderung</li>
              <li>Restmunition unverzüglich aus der Waffe entfernen</li>
              <li>Den Anweisungen des Leitenden und der Aufsichten ist unbedingt Folge zu leisten</li>
              <li>Striktes Alkoholverbot</li>
              <li>Rauchverbot</li>
            </ul>

            <div className="mt-8">
              <Link
                href="/dokumente/RAG_Schiesssport_Sicherheitsbelehrung_Stand_01-2019.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="document-download-link document-download-link-download document-download-link-start"
              >
                <DownloadDocumentIcon className="h-5 w-5 shrink-0" />
                <span className="document-download-label">Sicherheitsbelehrung (PDF)</span>
              </Link>
            </div>
          </div>
        </section>
        <section className="card mt-6 p-6 sm:p-8 bg-brand-blue-50 border border-brand-blue-100">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
            Merkblatt zur Waffenaufbewahrung
          </h2>
          <div className="space-y-4 text-base sm:text-lg text-gray-700 leading-relaxed">
            <p>
              Ergänzend zur jährlichen Sicherheitsbelehrung steht ein kompaktes Merkblatt zur
              sicheren und rechtskonformen Aufbewahrung von Waffen und Munition bereit.
            </p>
            <p>
              Das Dokument eignet sich als schnelle Orientierung zu zentralen Anforderungen für
              Lagerung, Zugriffsschutz und organisatorische Sorgfalt im Alltag.
            </p>
            <div className="mt-6">
              <Link
                href="/dokumente/Merkblatt_Waffenaufbewahrung.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="document-download-link document-download-link-download document-download-link-start"
              >
                <DownloadDocumentIcon className="h-5 w-5 shrink-0" />
                <span className="document-download-label">Merkblatt Waffenaufbewahrung (PDF)</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
