import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import Database from "better-sqlite3";
import { prisma } from "@/lib/prisma";
import { GET as getNewsList } from "@/app/api/news/route";
import { GET as getNewsById } from "@/app/api/news/[id]/route";
import { runMigrations } from "../../scripts/run-db-migrations";
import { apiRequest, routeContext } from "./helpers/api";

// Release 1.8.0: Die News zum Vereinskalender kommt per Datenmigration
// (prisma/migrations/20261022_news_vereinskalender). Die Integrations-DB wurde
// in integration-env.ts bereits mit der vollständigen Kette aufgebaut.
const NEWS_ID = "news-vereinskalender-1-8-0";
const MIGRATION_NAME = "20261022_news_vereinskalender";
const KORREKTUR_MIGRATION = "20261023_news_vereinskalender_text";
// Die Migration setzt das Datum auf den Zeitpunkt ihres Laufs (Deployment); die
// Integrations-DB wurde unmittelbar vor dieser Testdatei migriert.
const ZEITFENSTER_MS = 60_000;

// Tests, die die Migrationskette erneut laufen lassen oder Daten löschen, arbeiten
// auf einer eigenen frischen DB — die gemeinsame Integrations-DB bleibt unverändert,
// die Tests sind damit reihenfolgeunabhängig.
function mitFrischerDb(pruefe: (db: InstanceType<typeof Database>, url: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), "rag-mse-release-news-"));
  const url = `file:${path.join(dir, "release.db")}`;
  try {
    runMigrations(url, { quiet: true });
    const db = new Database(path.join(dir, "release.db"));
    try {
      pruefe(db, url);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function anzahl(db: InstanceType<typeof Database>): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM "News" WHERE "id" = ?').get(NEWS_ID) as { n: number };
  return row.n;
}

function erwarteZeitpunktDesLaufs(datum: Date): void {
  expect(Number.isNaN(datum.getTime())).toBe(false);
  expect(Math.abs(Date.now() - datum.getTime())).toBeLessThan(ZEITFENSTER_MS);
}

// Vom Product Owner freigegebener Text (Ticket .scratch/kalender/issues/08), wörtlich,
// in der Fassung nach der Korrektur vom 19.10.2026 (Migration 20261023).
const FREIGEGEBENER_TEXT = [
  "Ab sofort gibt es unter „Kalender“ eine Monats-, Wochen- und Listenansicht aller Termine. Öffentliche Termine sieht jeder, und der Kalender lässt sich als iCal-Abo in die eigene Kalender-App übernehmen. Eingeloggte Mitglieder sehen zusätzlich interne Termine sowie Termine anderer Veranstalter, etwa geplante RDLs oder Veranstaltungen anderer Reservistenkameradschaften.",
  "Neu ist auch: Ihr könnt im Kalender eure Abwesenheiten eintragen, zum Beispiel Urlaub oder Schichtdienst. Diese Einträge sehen nur ihr selbst sowie die Administratoren und Prüfer des Vereins. Sie helfen uns, Termine so zu planen, dass möglichst viele teilnehmen können. Abwesenheiten werden 30 Tage nach ihrem Ende automatisch gelöscht.",
].join("\n\n");
const ORIGINALTEXT = FREIGEGEBENER_TEXT.replace(
  "sowie die Administratoren und Prüfer des Vereins.",
  "und der Vorstand."
);

function inhalt(db: InstanceType<typeof Database>): string {
  const row = db.prepare('SELECT "content" FROM "News" WHERE "id" = ?').get(NEWS_ID) as { content: string };
  return row.content;
}

describe("Release-News 1.8.0 (Datenmigration)", () => {
  const vergleichsIds: string[] = [];

  afterEach(async () => {
    await prisma.news.deleteMany({ where: { id: { in: vergleichsIds.splice(0) } } });
  });

  it("legt die News genau einmal veröffentlicht mit dem Zeitpunkt des Laufs an", async () => {
    const news = await prisma.news.findMany({ where: { title: "Neu: Der Vereinskalender" } });

    expect(news).toHaveLength(1);
    expect(news[0]).toMatchObject({ id: NEWS_ID, published: true });
    erwarteZeitpunktDesLaufs(news[0].newsDate);
    erwarteZeitpunktDesLaufs(news[0].createdAt);
    erwarteZeitpunktDesLaufs(news[0].updatedAt);
    expect(news[0].createdAt.getTime()).toBe(news[0].newsDate.getTime());
  });

  it("enthält den freigegebenen Klartext mit Absatz-Leerzeile", async () => {
    const news = await prisma.news.findUniqueOrThrow({ where: { id: NEWS_ID } });

    expect(news.content).toBe(FREIGEGEBENER_TEXT);
    expect(news.content.split("\n\n")).toHaveLength(2);
    expect(news.content).toContain("„Kalender“");
    expect(news.content).not.toMatch(/<[a-z]/i);
  });

  it("ist über die öffentliche News-API lesbar", async () => {
    const release = await prisma.news.findUniqueOrThrow({ where: { id: NEWS_ID } });

    const listResponse = await getNewsList(apiRequest("GET", "/api/news"));
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json();
    const eintrag = list.news.find((n: { id: string }) => n.id === NEWS_ID);
    expect(eintrag).toMatchObject({
      title: "Neu: Der Vereinskalender",
      published: true,
      newsDate: release.newsDate.toISOString(),
    });

    const detailResponse = await getNewsById(
      apiRequest("GET", `/api/news/${NEWS_ID}`),
      routeContext({ id: NEWS_ID })
    );
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json();
    expect(detail.newsDate).toBe(release.newsDate.toISOString());
    expect(detail.content).toBe(FREIGEGEBENER_TEXT);
  });

  it("sortiert sich korrekt zwischen per Prisma angelegten News ein", async () => {
    const release = await prisma.news.findUniqueOrThrow({ where: { id: NEWS_ID } });
    const tag = 24 * 60 * 60 * 1000;
    const aelter = await prisma.news.create({
      data: { title: "Ältere News", content: "x", newsDate: new Date(release.newsDate.getTime() - tag) },
    });
    const neuer = await prisma.news.create({
      data: { title: "Neuere News", content: "x", newsDate: new Date(release.newsDate.getTime() + tag) },
    });
    vergleichsIds.push(aelter.id, neuer.id);

    const response = await getNewsList(apiRequest("GET", "/api/news"));
    const ids = (await response.json()).news.map((n: { id: string }) => n.id);

    expect(ids.filter((id: string) => [aelter.id, NEWS_ID, neuer.id].includes(id))).toEqual([
      neuer.id,
      NEWS_ID,
      aelter.id,
    ]);
  });

  it("dupliziert die News nicht, auch wenn die Migration erneut läuft", () => {
    mitFrischerDb((db, url) => {
      runMigrations(url, { quiet: true });
      expect(anzahl(db)).toBe(1);

      // Ohne Migrationseintrag läuft das INSERT erneut — INSERT OR IGNORE verhindert das Duplikat.
      db.prepare('DELETE FROM "_AppMigration" WHERE "name" = ?').run(MIGRATION_NAME);
      runMigrations(url, { quiet: true });
      expect(anzahl(db)).toBe(1);
    });
  });

  it("korrigiert den Originaltext aus 20261022 genau einmal", () => {
    mitFrischerDb((db, url) => {
      expect(anzahl(db)).toBe(1);
      expect(inhalt(db)).toBe(FREIGEGEBENER_TEXT);

      db.prepare('UPDATE "News" SET "content" = ? WHERE "id" = ?').run(ORIGINALTEXT, NEWS_ID);
      db.prepare('DELETE FROM "_AppMigration" WHERE "name" = ?').run(KORREKTUR_MIGRATION);
      runMigrations(url, { quiet: true });

      expect(anzahl(db)).toBe(1);
      expect(inhalt(db)).toBe(FREIGEGEBENER_TEXT);
    });
  });

  it("lässt eine im Adminbereich bearbeitete News unverändert", () => {
    mitFrischerDb((db, url) => {
      const bearbeitet = `${ORIGINALTEXT}\n\nNachtrag vom Vorstand.`;
      db.prepare('UPDATE "News" SET "content" = ? WHERE "id" = ?').run(bearbeitet, NEWS_ID);
      db.prepare('DELETE FROM "_AppMigration" WHERE "name" = ?').run(KORREKTUR_MIGRATION);
      runMigrations(url, { quiet: true });

      expect(inhalt(db)).toBe(bearbeitet);
    });
  });

  it("läuft dank _AppMigration-Eintrag nicht erneut, eine gelöschte News bleibt gelöscht", () => {
    mitFrischerDb((db, url) => {
      db.prepare('DELETE FROM "News" WHERE "id" = ?').run(NEWS_ID);

      runMigrations(url, { quiet: true });

      expect(anzahl(db)).toBe(0);
    });
  });
});
