import { findCollisions, findItemsOnDay, type CollisionSources } from "@/lib/collisions";

function sources(overrides: Partial<CollisionSources> = {}): CollisionSources {
  return { termine: [], fremdtermine: [], abwesenheiten: [], ...overrides };
}

describe("findCollisions", () => {
  it("meldet zwei Termine am selben Tag gegenseitig, unabhängig von den Uhrzeiten", () => {
    const result = findCollisions(
      sources({
        termine: [
          { id: "morgens", date: "2026-11-10" },
          { id: "abends", date: "2026-11-10" },
          { id: "anderer-tag", date: "2026-11-11" },
        ],
      })
    );

    expect(result.days).toEqual(["2026-11-10"]);
    expect(result.byTermin.get("morgens")).toEqual([{ kind: "termin", id: "abends", startDate: "2026-11-10", endDate: "2026-11-10" }]);
    expect(result.byTermin.get("abends")?.map((item) => item.id)).toEqual(["morgens"]);
    expect(result.byTermin.has("anderer-tag")).toBe(false);
  });

  it("ein Termin kollidiert nie mit sich selbst", () => {
    const result = findCollisions(sources({ termine: [{ id: "t1", date: "2026-11-10" }] }));
    expect(result.days).toEqual([]);
    expect(result.byTermin.size).toBe(0);
  });

  it("berücksichtigt mehrtägige Fremdtermine und Abwesenheiten mit inklusivem Ende", () => {
    const result = findCollisions(
      sources({
        termine: [
          { id: "vorher", date: "2026-11-13" },
          { id: "erster", date: "2026-11-14" },
          { id: "mitte", date: "2026-11-15" },
          { id: "letzter", date: "2026-11-16" },
          { id: "danach", date: "2026-11-17" },
        ],
        fremdtermine: [{ id: "rdl", startDate: "2026-11-14", endDate: "2026-11-16" }],
        abwesenheiten: [{ id: "urlaub", startDate: "2026-11-16", endDate: "2026-11-16" }],
      })
    );

    expect(result.days).toEqual(["2026-11-14", "2026-11-15", "2026-11-16"]);
    expect(result.byTermin.get("letzter")?.map((item) => `${item.kind}:${item.id}`)).toEqual([
      "fremdtermin:rdl",
      "abwesenheit:urlaub",
    ]);
    expect(result.byTermin.has("vorher")).toBe(false);
    expect(result.byTermin.has("danach")).toBe(false);
  });

  it("ein Tag ohne Termin ist keine Kollision, auch wenn sich Fremdtermine und Abwesenheiten überlagern", () => {
    const result = findCollisions(
      sources({
        fremdtermine: [{ id: "rdl", startDate: "2026-11-01", endDate: "2026-11-30" }],
        abwesenheiten: [{ id: "urlaub", startDate: "2026-11-10", endDate: "2026-11-12" }],
      })
    );
    expect(result.days).toEqual([]);
  });

  it("rechnet über das Umstellungswochenende auf Winterzeit (25.10.2026) tagesgenau", () => {
    const result = findCollisions(
      sources({
        termine: [
          { id: "samstag", date: "2026-10-24" },
          { id: "sonntag", date: "2026-10-25" },
          { id: "montag", date: "2026-10-26" },
        ],
        fremdtermine: [{ id: "wochenende", startDate: "2026-10-24", endDate: "2026-10-25" }],
        abwesenheiten: [{ id: "ab-montag", startDate: "2026-10-26", endDate: "2026-10-27" }],
      })
    );

    expect(result.days).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
    expect(result.byTermin.get("sonntag")?.map((item) => item.id)).toEqual(["wochenende"]);
    expect(result.byTermin.get("montag")?.map((item) => item.id)).toEqual(["ab-montag"]);
  });

  it("Monats- und Jahresgrenzen werden über ISO-Daten korrekt verglichen", () => {
    const result = findCollisions(
      sources({
        termine: [
          { id: "silvester", date: "2026-12-31" },
          { id: "neujahr", date: "2027-01-01" },
        ],
        abwesenheiten: [{ id: "jahreswechsel", startDate: "2026-12-30", endDate: "2027-01-01" }],
      })
    );
    expect(result.days).toEqual(["2026-12-31", "2027-01-01"]);
  });
});

describe("findItemsOnDay", () => {
  const all = sources({
    termine: [
      { id: "eigener", date: "2026-11-10" },
      { id: "verborgen", date: "2026-11-10" },
    ],
    fremdtermine: [{ id: "rdl", startDate: "2026-11-09", endDate: "2026-11-10" }],
    abwesenheiten: [{ id: "urlaub", startDate: "2026-11-11", endDate: "2026-11-12" }],
  });

  it("liefert alle Einträge des Tages ohne den ausgenommenen Termin", () => {
    expect(findItemsOnDay(all, "2026-11-10", "eigener").map((item) => item.id)).toEqual(["verborgen", "rdl"]);
  });

  it("nimmt nur Termine aus, nicht gleichnamige Fremdtermine", () => {
    expect(findItemsOnDay(all, "2026-11-10", "rdl").map((item) => item.id)).toEqual(["eigener", "verborgen", "rdl"]);
  });

  it("liefert für einen freien Tag nichts", () => {
    expect(findItemsOnDay(all, "2026-11-13")).toEqual([]);
  });
});
