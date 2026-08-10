import { test, expect } from "@playwright/test";
import { anmelden } from "./helpers";
import { E2E_MITGLIED, E2E_UMFRAGE } from "./testdaten";

test("Mitglied stimmt in der Live-Umfrage ab und sieht das Ergebnis", async ({
  page,
}) => {
  await anmelden(page, E2E_MITGLIED);

  await page.goto("/umfragen");
  await page.getByRole("link", { name: new RegExp(E2E_UMFRAGE.title) }).click();

  await expect(
    page.getByRole("heading", { name: E2E_UMFRAGE.title })
  ).toBeVisible();

  await page.getByRole("radio", { name: E2E_UMFRAGE.optionA }).click();
  await page.getByRole("button", { name: "Abstimmen" }).click();

  // Wiederholbar auch gegen dieselbe Server-Instanz: die Route ersetzt die
  // Stimme des Mitglieds (deleteMany + createMany), zählt sie also nicht hoch.
  await expect(page.getByText("Ihre Stimme wurde gespeichert")).toBeVisible();
  await expect(page.getByText("Ihre Stimme", { exact: true })).toBeVisible();
  await expect(page.getByText("100% (1)")).toBeVisible();
  await expect(page.getByText("1 Stimme abgegeben")).toBeVisible();
});
