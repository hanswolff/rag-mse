import { formatOccupancy, isOverbooked } from "@/lib/registration-count";

describe("formatOccupancy", () => {
  it("counts only Ja-Anmeldungen as occupied", () => {
    expect(formatOccupancy({ JA: 7, NEIN: 4, VIELLEICHT: 0 }, 12)).toBe("7 von 12 Plätzen belegt");
  });

  it("shows Vielleicht as an addition without occupying a place", () => {
    expect(formatOccupancy({ JA: 7, NEIN: 1, VIELLEICHT: 3 }, 12)).toBe(
      "7 von 12 Plätzen belegt (+3 vielleicht)"
    );
  });

  it("uses the singular for a single place", () => {
    expect(formatOccupancy({ JA: 0, NEIN: 0, VIELLEICHT: 0 }, 1)).toBe("0 von 1 Platz belegt");
  });

  it("keeps reporting beyond the capacity", () => {
    expect(formatOccupancy({ JA: 15, NEIN: 0, VIELLEICHT: 0 }, 12)).toBe("15 von 12 Plätzen belegt");
  });
});

describe("isOverbooked", () => {
  it("is true when more Ja-Anmeldungen than places exist", () => {
    expect(isOverbooked({ JA: 13, NEIN: 0, VIELLEICHT: 0 }, 12)).toBe(true);
  });

  it("is false when the places are exactly filled", () => {
    expect(isOverbooked({ JA: 12, NEIN: 0, VIELLEICHT: 0 }, 12)).toBe(false);
  });

  it("does not count Vielleicht towards overbooking", () => {
    expect(isOverbooked({ JA: 12, NEIN: 0, VIELLEICHT: 5 }, 12)).toBe(false);
  });
});
