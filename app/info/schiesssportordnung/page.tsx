import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { DownloadDocumentIcon } from "@/components/icons";

type DisciplineRow = {
  waffengruppe: string;
  spo: string;
  disziplin: string;
  kennziffer: string;
  schuss: string;
  uebung: string;
  kaliberAb: string;
  kaliberBis: string;
};

const csvHeaders = [
  "Waffengruppe",
  "SPO",
  "Disziplin",
  "Kennziffer",
  "Schuss",
  "Übung",
  "Kaliber ab",
  "Kaliber bis",
] as const;

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

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseDisciplineCsv(csvContent: string): DisciplineRow[] {
  const normalized = csvContent.replace(/^\uFEFF/, "");
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  const hasExpectedHeader = csvHeaders.every(
    (expected, index) => header[index] === expected,
  );

  if (!hasExpectedHeader) {
    return [];
  }

  return lines.slice(1).map((line) => {
    const [waffengruppe, spo, disziplin, kennziffer, schuss, uebung, kaliberAb, kaliberBis] =
      parseCsvLine(line);

    return {
      waffengruppe: waffengruppe ?? "",
      spo: spo ?? "",
      disziplin: disziplin ?? "",
      kennziffer: kennziffer ?? "",
      schuss: schuss ?? "",
      uebung: uebung ?? "",
      kaliberAb: kaliberAb ?? "",
      kaliberBis: kaliberBis ?? "",
    };
  });
}

async function loadDisciplineRows(): Promise<DisciplineRow[]> {
  const csvPath = path.join(
    process.cwd(),
    "app",
    "info",
    "schiesssportordnung",
    "disziplinen.csv",
  );

  try {
    const csvContent = await readFile(csvPath, "utf-8");
    return parseDisciplineCsv(csvContent);
  } catch {
    return [];
  }
}

export default async function SchiesssportordnungPage() {
  const disciplineRows = await loadDisciplineRows();

  return (
    <main className="flex-1 bg-gray-50">
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
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
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
            <section className="mt-8">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                Disziplinen
              </h2>
              {disciplineRows.length > 0 ? (
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm sm:text-base">
                    <thead className="bg-gray-100 text-gray-900">
                      <tr>
                        {csvHeaders.map((header) => (
                          <th
                            key={header}
                            scope="col"
                            className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {disciplineRows.map((row) => (
                        <tr key={`${row.kennziffer}-${row.disziplin}`} className="border-t border-gray-200">
                          <td className="px-4 py-3 whitespace-nowrap">{row.waffengruppe}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{row.spo}</td>
                          <td className="px-4 py-3">{row.disziplin}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{row.kennziffer}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{row.schuss || "-"}</td>
                          <td className="px-4 py-3">{row.uebung || "-"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{row.kaliberAb || "-"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{row.kaliberBis || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm sm:text-base text-gray-600">
                  Die Disziplinen konnten derzeit nicht geladen werden.
                </p>
              )}
            </section>
            <div className="mt-6 text-center">
              <Link
                href="/dokumente/vdrbw_sportordnung.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary document-download-link text-base"
              >
                <DownloadDocumentIcon className="h-5 w-5 shrink-0" />
                <span className="document-download-label">Schießsportordnung herunterladen (PDF)</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
