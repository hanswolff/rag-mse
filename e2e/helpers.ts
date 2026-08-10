import { expect, type Page } from "@playwright/test";

export interface Konto {
  email: string;
  password: string;
  name: string;
}

// Echter UI-Login über /login — der loginProof-Preflight und der
// NextAuth-Credentials-Flow laufen dabei wie im Browser des Nutzers.
export async function anmelden(page: Page, konto: Konto): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/^E-Mail/).fill(konto.email);
  await page.getByLabel(/^Passwort/).fill(konto.password);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: konto.name })).toBeVisible();
}
