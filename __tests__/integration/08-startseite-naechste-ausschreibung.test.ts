import { prisma } from "@/lib/prisma";
import { getNaechsteAktuelleAusschreibung } from "@/lib/ausschreibung-query";
import { parseIsoDateOnlyToUtcDate } from "@/lib/date-picker-utils";

// Die Startseite blendet die Ausschreibungen-Karte allein anhand dieser Abfrage ein.
// Die Tagesgrenze ("gilt bis einschließlich des Ablauftages", CONTEXT.md) steckt im
// Datenbankfilter und lässt sich nur gegen eine echte Datenbank prüfen: ein `gt`
// statt `gte` würde die heute ablaufende Ausschreibung stillschweigend verschlucken.

// 12:00 MESZ am 09.08.2026 — der deutsche Kalendertag ist damit eindeutig,
// unabhängig von der Prozesszeitzone.
const REFERENZZEITPUNKT = new Date("2026-08-09T10:00:00.000Z");
const HEUTE = "2026-08-09";
const GESTERN = "2026-08-08";
const MORGEN = "2026-08-10";
const NAECHSTE_WOCHE = "2026-08-16";

let laufendeNummer = 0;

async function createAusschreibung(title: string, ablaufdatum: string) {
  laufendeNummer += 1;
  return prisma.ausschreibung.create({
    data: {
      title,
      expiresAt: parseIsoDateOnlyToUtcDate(ablaufdatum),
      originalFileName: `${title}.pdf`,
      storedFileName: `ausschreibung-${laufendeNummer}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 4096,
    },
  });
}

describe("Nächste aktuelle Ausschreibung", () => {
  beforeEach(async () => {
    await prisma.ausschreibung.deleteMany();
  });

  it("findet eine Ausschreibung, die heute abläuft", async () => {
    await createAusschreibung("Läuft heute ab", HEUTE);

    const gefunden = await getNaechsteAktuelleAusschreibung(REFERENZZEITPUNKT);

    expect(gefunden?.title).toBe("Läuft heute ab");
    expect(gefunden?.expiresAt.toISOString()).toBe("2026-08-09T00:00:00.000Z");
  });

  it("ignoriert eine gestern abgelaufene Ausschreibung", async () => {
    await createAusschreibung("Gestern abgelaufen", GESTERN);

    expect(await getNaechsteAktuelleAusschreibung(REFERENZZEITPUNKT)).toBeNull();
  });

  it("liefert von mehreren aktuellen die mit dem frühesten Ablaufdatum", async () => {
    await createAusschreibung("Später", NAECHSTE_WOCHE);
    await createAusschreibung("Früher", MORGEN);

    const gefunden = await getNaechsteAktuelleAusschreibung(REFERENZZEITPUNKT);

    expect(gefunden?.title).toBe("Früher");
  });

  it("zieht eine historische Ausschreibung nicht vor, obwohl ihr Datum früher liegt", async () => {
    await createAusschreibung("Historisch", GESTERN);
    await createAusschreibung("Aktuell", MORGEN);

    const gefunden = await getNaechsteAktuelleAusschreibung(REFERENZZEITPUNKT);

    expect(gefunden?.title).toBe("Aktuell");
  });

  it("liefert null, wenn es keine Ausschreibung gibt", async () => {
    expect(await getNaechsteAktuelleAusschreibung(REFERENZZEITPUNKT)).toBeNull();
  });
});
