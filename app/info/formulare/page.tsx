import Link from "next/link";
import { DownloadDocumentIcon, ExternalLinkIcon } from "@/components/icons";

const ACTION_CLASSES = "inline-flex items-center gap-2 text-sm";

const pathways = [
  {
    title: "Mitglied werden",
    description:
      "Sie möchten der RAG Schießsport MSE beitreten. Nutzen Sie den Aufnahmeantrag für die Anmeldung.",
    actions: [
      {
        label: "Aufnahmeantrag herunterladen",
        href: "/dokumente/Aufnahmeantrag.pdf",
        className: "btn-secondary"
      }
    ]
  },
  {
    title: "Munitionserwerb dokumentieren",
    description:
      "Für Mitglieder ohne waffenrechtliche Erlaubnis. Das Formular wird vor Ort vom Schießleiter ausgefüllt.",
    actions: [
      {
        label: "Formular Munitionserwerb herunterladen",
        href: "/dokumente/Munitionserwerb.pdf",
        className: "btn-secondary"
      }
    ]
  }
];

export default function FormularePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="card p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
            RAG MSE Formulare
          </h1>
          <div className="space-y-4 text-base sm:text-lg text-gray-700 leading-relaxed">
            <p>
              Wählen Sie Ihr Anliegen aus und gehen Sie direkt zum passenden Formular.
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 pt-2">Was möchten Sie tun?</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-2">
              {pathways.map((pathway) => (
                <article
                  key={pathway.title}
                  className="border border-gray-200 rounded-lg p-5 bg-white flex flex-col"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">{pathway.title}</h3>
                  <p className="text-sm text-gray-600 mb-4">{pathway.description}</p>
                  <div className="mt-auto flex flex-col gap-2">
                    {pathway.actions.map((action) => (
                      <Link
                        key={action.label}
                        href={action.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${action.className} ${ACTION_CLASSES}`}
                      >
                        <DownloadDocumentIcon className="w-4 h-4" />
                        {action.label}
                      </Link>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="card p-6 sm:p-8 mt-6 bg-brand-blue-50 border border-brand-blue-100">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
            Hinweise zu behördlichen Formularen
          </h2>
          <div className="space-y-4 text-base sm:text-lg text-gray-700 leading-relaxed">
            <p>
              Waffenrechtliche Formulare werden durch die zuständige Behörde bereitgestellt und aktualisiert.
            </p>
            <p>
              Für den Landkreis Mecklenburgische Seenplatte nutzen Sie bitte ausschließlich die offizielle Website.
            </p>
            <div className="mt-6">
              <Link
                href="https://www.lk-mecklenburgische-seenplatte.de/Angebote/Waffenrecht-Formulare.php?object=tx,2761.5.1&ModID=7&FID=2761.20694.1&NavID=2761.8&La=1"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2 text-base"
              >
                <ExternalLinkIcon className="w-5 h-5" />
                Waffenrecht-Formulare des Landkreises
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
