import { pluralize } from "@/lib/pluralization";

describe("pluralize", () => {
  it("returns singular form for count of 1", () => {
    expect(pluralize(1, "Stimme", "Stimmen")).toBe("Stimme");
  });

  it("returns plural form for count of 0", () => {
    expect(pluralize(0, "Stimme", "Stimmen")).toBe("Stimmen");
  });

  it("returns plural form for count of 2", () => {
    expect(pluralize(2, "Stimme", "Stimmen")).toBe("Stimmen");
  });

  it("returns plural form for count greater than 1", () => {
    expect(pluralize(5, "Stimme", "Stimmen")).toBe("Stimmen");
    expect(pluralize(10, "Stimme", "Stimmen")).toBe("Stimmen");
    expect(pluralize(100, "Stimme", "Stimmen")).toBe("Stimmen");
  });

  it("handles negative counts correctly", () => {
    expect(pluralize(-1, "Stimme", "Stimmen")).toBe("Stimmen");
    expect(pluralize(-5, "Stimme", "Stimmen")).toBe("Stimmen");
  });

  it("works with different word pairs", () => {
    expect(pluralize(1, "Tag", "Tage")).toBe("Tag");
    expect(pluralize(2, "Tag", "Tage")).toBe("Tage");
    expect(pluralize(0, "Tag", "Tage")).toBe("Tage");
  });

  it("handles edge cases", () => {
    expect(pluralize(1.5, "Stimme", "Stimmen")).toBe("Stimmen");
    expect(pluralize(Number.MAX_SAFE_INTEGER, "Stimme", "Stimmen")).toBe("Stimmen");
  });
});
