import { test, expect } from "@playwright/test";
import { anmelden } from "./helpers";
import { E2E_MITGLIED, E2E_TERMIN } from "./testdaten";

test("Mitglied meldet Teilnahme mit Ja an und zieht sie zurück", async ({
  page,
}) => {
  await anmelden(page, E2E_MITGLIED);

  await page.goto("/termine");
  await page.getByRole("link", { name: new RegExp(E2E_TERMIN.title) }).click();

  const teilnahme = page.locator("section", {
    has: page.getByRole("heading", { name: "Teilnahmeanmeldung" }),
  });
  await expect(teilnahme).toBeVisible();
  await expect(teilnahme.getByText("Melden Sie Ihre Teilnahme an:")).toBeVisible();

  await teilnahme.getByRole("button", { name: "Ja", exact: true }).click();

  await expect(
    teilnahme.getByText("Sie haben sich bereits angemeldet:")
  ).toBeVisible();
  await expect(
    teilnahme.getByRole("heading", { name: "Anmeldestand (1 Anmeldung)" })
  ).toBeVisible();

  await teilnahme.getByRole("button", { name: "Anmeldung zurückziehen" }).click();

  await expect(teilnahme.getByText("Melden Sie Ihre Teilnahme an:")).toBeVisible();
  await expect(
    teilnahme.getByRole("heading", { name: "Anmeldestand (0 Anmeldungen)" })
  ).toBeVisible();
});
