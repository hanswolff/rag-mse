import { test, expect } from "@playwright/test";

const SEITEN = [
  { pfad: "/", ueberschrift: /RAG Schießsport MSE/ },
  { pfad: "/termine", ueberschrift: /^Termine$/ },
  { pfad: "/ausschreibungen", ueberschrift: /^Ausschreibungen$/ },
  { pfad: "/news", ueberschrift: /News/ },
] as const;

test("Öffentliche Seiten rendern ohne Konsolen-Fehler", async ({ page }) => {
  const fehler: string[] = [];
  page.on("console", (nachricht) => {
    if (nachricht.type() === "error") {
      fehler.push(`[console] ${page.url()}: ${nachricht.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    fehler.push(`[pageerror] ${page.url()}: ${error.message}`);
  });

  for (const seite of SEITEN) {
    await page.goto(seite.pfad);
    await expect(
      page.getByRole("heading", { level: 1, name: seite.ueberschrift })
    ).toBeVisible();
  }

  expect(fehler, `Konsolen-Fehler gefunden:\n${fehler.join("\n")}`).toEqual([]);
});
