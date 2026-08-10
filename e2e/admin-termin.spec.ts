import { test, expect } from "@playwright/test";
import { anmelden } from "./helpers";
import { E2E_ADMIN, terminDatumInZukunft } from "./testdaten";

const NEUER_TERMIN_TITEL = "E2E Admin-Termin Neustrelitz";

function alsDeutschesDatum(datum: Date): string {
  const tag = String(datum.getDate()).padStart(2, "0");
  const monat = String(datum.getMonth() + 1).padStart(2, "0");
  return `${tag}.${monat}.${datum.getFullYear()}`;
}

test("Admin legt einen Termin an, der in der öffentlichen Liste erscheint", async ({
  page,
}) => {
  await anmelden(page, E2E_ADMIN);

  await page.goto("/admin/termine");
  await page.getByRole("button", { name: "Neuen Termin erstellen" }).click();

  const modal = page.getByRole("dialog");
  await expect(
    modal.getByRole("heading", { name: "Neuen Termin erstellen" })
  ).toBeVisible();

  // Escape schließt das Popup von react-datepicker bzw. der Zeitauswahl, das
  // sonst über dem nächsten Feld liegt.
  await modal.getByLabel("Datum").fill(alsDeutschesDatum(terminDatumInZukunft(28)));
  await page.keyboard.press("Escape");
  await modal.getByLabel("Uhrzeit von").fill("18:00");
  await page.keyboard.press("Escape");
  await modal.getByLabel("Uhrzeit bis").fill("20:00");
  await page.keyboard.press("Escape");
  await modal.getByLabel("Titel").fill(NEUER_TERMIN_TITEL);
  await modal.getByLabel("Ort").fill("Schießstand Neustrelitz");
  // Beschreibung ist ein Rich-Text-Editor: contenteditable statt Formularfeld.
  await modal
    .locator('div[contenteditable="true"]')
    .fill("Vom Admin über die E2E-Suite angelegter Termin.");

  await modal.getByRole("button", { name: "Erstellen" }).click();

  await expect(page.getByText("Termin wurde erfolgreich erstellt")).toBeVisible();

  await page.goto("/termine");
  await expect(
    page.getByRole("link", { name: new RegExp(NEUER_TERMIN_TITEL) })
  ).toBeVisible();
});
