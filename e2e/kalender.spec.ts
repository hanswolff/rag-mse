import { test, expect } from "@playwright/test";
import { anmelden } from "./helpers";
import { E2E_ADMIN, E2E_TERMIN, terminDatumInZukunft } from "./testdaten";

function alsIsoDatum(datum: Date): string {
  const monat = String(datum.getMonth() + 1).padStart(2, "0");
  const tag = String(datum.getDate()).padStart(2, "0");
  return `${datum.getFullYear()}-${monat}-${tag}`;
}

test("Admin sieht Kollisionen auch in der Listenansicht des Kalenders", async ({ page }) => {
  const terminTag = alsIsoDatum(terminDatumInZukunft());
  await anmelden(page, E2E_ADMIN);

  const status = await page.evaluate(async (tag) => {
    const response = await fetch("/api/abwesenheiten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: tag, endDate: tag, allDay: true, timeFrom: null, timeTo: null, reason: "Urlaub" }),
    });
    return response.status;
  }, terminTag);
  expect(status).toBe(201);

  await page.goto(`/kalender?ansicht=liste&datum=${terminTag}`);
  await expect(page.getByText(E2E_TERMIN.title)).toBeVisible();

  const kopfzeile = page.locator(`tr.fc-list-day[data-date="${terminTag}"]`);
  await expect(kopfzeile).toHaveClass(/calendar-collision-day/);
  await expect(kopfzeile.getByText("Kollision")).toBeVisible();
});
