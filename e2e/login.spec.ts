import { test, expect } from "@playwright/test";
import { anmelden } from "./helpers";
import { E2E_MITGLIED } from "./testdaten";

test("Login mit Seed-Mitglied gelingt über den UI-Flow", async ({ page }) => {
  await anmelden(page, E2E_MITGLIED);

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: E2E_MITGLIED.name })
  ).toBeVisible();
});

test("Falsches Passwort zeigt eine Fehlermeldung", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/^E-Mail/).fill(E2E_MITGLIED.email);
  await page.getByLabel(/^Passwort/).fill("VoelligFalsches!Passwort99");
  await page.getByRole("button", { name: "Einloggen" }).click();

  await expect(page.getByText("Ungültige E-Mail oder Passwort")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
