// Parser für die Disziplinen-Tabelle der Schießsportordnung
// (app/info/schiesssportordnung/disziplinen.csv).

export type DisciplineRow = {
  waffengruppe: string;
  spo: string;
  disziplin: string;
  kennziffer: string;
  schuss: string;
  uebung: string;
  kaliberAb: string;
  kaliberBis: string;
};

export const DISCIPLINE_CSV_HEADERS = [
  "Waffengruppe",
  "SPO",
  "Disziplin",
  "Kennziffer",
  "Schuss",
  "Übung",
  "Kaliber ab",
  "Kaliber bis",
] as const;

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

export function parseDisciplineCsv(csvContent: string): DisciplineRow[] {
  const normalized = csvContent.replace(/^\uFEFF/, "");
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  const hasExpectedHeader = DISCIPLINE_CSV_HEADERS.every(
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
