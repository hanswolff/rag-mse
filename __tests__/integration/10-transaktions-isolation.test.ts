import { prisma } from "@/lib/prisma";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class GewollterRollback extends Error {}

async function transaktionMitRollback(dauerMs: number, titel = "Transaktion"): Promise<void> {
  await prisma
    .$transaction(async (tx) => {
      await tx.news.create({ data: { title: titel, content: "zurückgerollt" } });
      await pause(dauerMs);
      throw new GewollterRollback();
    })
    .catch((error: unknown) => {
      if (!(error instanceof GewollterRollback)) throw error;
    });
}

describe("Transaktionen sind gegen parallele Abfragen isoliert", () => {
  beforeEach(async () => {
    await prisma.news.deleteMany();
  });

  it("verliert einen parallelen Schreibvorgang nicht, wenn die Transaktion zurückrollt", async () => {
    const transaktion = transaktionMitRollback(200);
    await pause(20);

    const aussen = await prisma.news.create({ data: { title: "Außen", content: "bleibt" } });
    await transaktion;

    const titel = (await prisma.news.findMany()).map((news) => news.title);
    expect(aussen.id).toBeTruthy();
    expect(titel).toEqual(["Außen"]);
  });

  it("lässt Abfragen über den Transaktions-Client ohne Warten durch", async () => {
    const ergebnis = await prisma.$transaction(async (tx) => {
      await tx.news.create({ data: { title: "Innen", content: "x" } });
      await tx.$executeRaw`UPDATE "News" SET "content" = 'y'`;
      const [zeile] = await tx.$queryRaw<Array<{ anzahl: number }>>`SELECT COUNT(*) AS anzahl FROM "News"`;
      return { anzahl: Number(zeile.anzahl), gelesen: await tx.news.findFirstOrThrow() };
    });

    expect(ergebnis.anzahl).toBe(1);
    expect(ergebnis.gelesen.content).toBe("y");
  });

  it("lässt parallele Abfragen außerhalb warten, bis die Transaktion abgeschlossen ist", async () => {
    const reihenfolge: string[] = [];
    const transaktion = prisma.$transaction(async (tx) => {
      await tx.news.create({ data: { title: "Innen", content: "x" } });
      await pause(100);
      reihenfolge.push("commit");
    });
    await pause(10);

    const aussen = Promise.all([
      prisma.news.count().then((anzahl) => {
        reihenfolge.push("count");
        return anzahl;
      }),
      prisma.$queryRaw<Array<{ eins: number }>>`SELECT 1 AS eins`.then(() => {
        reihenfolge.push("queryRaw");
      }),
      prisma.news.create({ data: { title: "Außen", content: "x" } }).then(() => {
        reihenfolge.push("create");
      }),
    ]);

    const [[anzahl]] = await Promise.all([aussen, transaktion]);

    expect(reihenfolge[0]).toBe("commit");
    expect(anzahl).toBe(1);
    expect(await prisma.news.count()).toBe(2);
  });

  it("serialisiert Batch-Transaktionen mit interaktiven Transaktionen", async () => {
    const transaktion = transaktionMitRollback(100);
    await pause(10);

    await prisma.$transaction([
      prisma.news.create({ data: { title: "Batch 1", content: "x" } }),
      prisma.news.create({ data: { title: "Batch 2", content: "x" } }),
    ]);
    await transaktion;

    const titel = (await prisma.news.findMany({ orderBy: { title: "asc" } })).map((n) => n.title);
    expect(titel).toEqual(["Batch 1", "Batch 2"]);
  });

  it("gibt die Sperre nach Fehlern frei, damit folgende Abfragen nicht hängen", async () => {
    await transaktionMitRollback(0);
    await expect(prisma.$queryRawUnsafe("SELECT * FROM gibt_es_nicht")).rejects.toThrow();

    await prisma.$transaction(async (tx) => {
      await tx.news.create({ data: { title: "Danach", content: "x" } });
    });

    expect(await prisma.news.count()).toBe(1);
  });

  it("gibt die Sperre frei, wenn Prisma die Transaktion wegen Timeout abbricht", async () => {
    const transaktion = prisma.$transaction(
      async (tx) => {
        await tx.news.create({ data: { title: "Innen", content: "x" } });
        await pause(300);
        await tx.news.create({ data: { title: "Zu spät", content: "x" } });
      },
      { timeout: 100 }
    );
    const abgebrochen = expect(transaktion).rejects.toThrow();
    await pause(10);

    await prisma.news.create({ data: { title: "Außen", content: "x" } });
    const titelWaehrenddessen = (await prisma.news.findMany()).map((news) => news.title);
    await abgebrochen;

    expect(titelWaehrenddessen).toEqual(["Außen"]);
    expect((await prisma.news.findMany()).map((news) => news.title)).toEqual(["Außen"]);
  });

  it("lässt nach einem gescheiterten COMMIT keine offene Transaktion auf der Verbindung zurück", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`PRAGMA defer_foreign_keys = ON`;
        await tx.$executeRaw`INSERT INTO "PollOption" ("id", "pollId", "text", "updatedAt") VALUES ('o1', 'gibt-es-nicht', 'x', CURRENT_TIMESTAMP)`;
      })
    ).rejects.toThrow();

    await prisma.news.create({ data: { title: "Außen", content: "bleibt" } });
    await transaktionMitRollback(0);

    const titel = (await prisma.news.findMany()).map((news) => news.title);
    expect(titel).toEqual(["Außen"]);
  });
});
