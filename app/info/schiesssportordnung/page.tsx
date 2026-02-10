import Link from "next/link";
import { DownloadDocumentIcon } from "@/components/icons";

const overviewPoints = [
  {
    title: "Zweck & Rahmen",
    text: "Einheitliche, verbindliche Regeln für den sicheren und sachkundigen Schießsport im VdRBw.",
  },
  {
    title: "Klare Abgrenzung",
    text: "Keine polizei- oder militärähnlichen Übungen; mehrere dynamische und überraschungsbasierte Elemente sind ausgeschlossen.",
  },
  {
    title: "Waffenrechtliche Grenzen",
    text: "Bestimmte Waffen und Ausstattungen sind sportlich ausgeschlossen oder nur unter besonderen Vorgaben zulässig.",
  },
  {
    title: "Organisation & Bedürfnis",
    text: "Schießsport im Rahmen der RAG Schießsport, mit klarer Verantwortungsstruktur und geregelter Bedürfnisbescheinigung.",
  },
  {
    title: "Sicherheit/Standordnung",
    text: "Strenge Sicherheits- und Disziplinvorgaben, inklusive klarer Verhaltensregeln am Stand.",
  },
  {
    title: "Auftreten & Nachweise",
    text: "Zivilkleidung, nachvollziehbare Schießnachweise und geregelter Versicherungsschutz, auch für Gäste.",
  },
  {
    title: "Wettkampf-Standardisierung",
    text: "Vorgaben zu Ausschreibungen, Fristen, Einsprüchen und neutraler Entscheidung.",
  },
  {
    title: "Disziplinen/Ausrüstung/Munition",
    text: "Detaillierte Vorgaben zu Disziplinen, zulässiger Ausrüstung und Munition mit Kontrollen.",
  },
];

export default function SchiesssportordnungPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="card p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
            Schießsportordnung
          </h1>
          <div className="space-y-4 text-base sm:text-lg text-gray-700 leading-relaxed">
            <p>
              Die Schießsportordnung des VdRBw legt verbindliche Regeln für
              Training und Wettkampf fest. Sie schafft einen einheitlichen
              Rahmen für alle Mitglieder und sorgt dafür, dass Schießsport
              verantwortungsvoll, rechtssicher und nachvollziehbar durchgeführt
              wird.
            </p>
            <p>
              Neben organisatorischen Vorgaben regelt sie insbesondere den
              sicheren Umgang mit Waffen und Munition, das Verhalten auf dem
              Schießstand sowie die Voraussetzungen für Wettbewerbe und
              Nachweise. Die Ordnung dient damit nicht nur der sportlichen
              Vergleichbarkeit, sondern vor allem der Sicherheit aller
              Beteiligten und der klaren Abgrenzung zu nicht-sportlichen
              Inhalten.
            </p>
            <p>Die wichtigsten Inhalte im Überblick:</p>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              {overviewPoints.map((point) => (
                <article
                  key={point.title}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <h2 className="text-base font-semibold text-gray-900">
                    {point.title}
                  </h2>
                  <p className="mt-2 text-sm sm:text-base text-gray-700">
                    {point.text}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link
                href="/dokumente/vdrbw_sportordnung.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center gap-2 text-base"
              >
                <DownloadDocumentIcon className="w-5 h-5" />
                Schießsportordnung herunterladen (PDF)
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
