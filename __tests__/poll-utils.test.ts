import { generatePollId, generateUniquePollId, getPollTypeLabel, getPollStatusLabel } from "@/lib/poll-utils";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    poll: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindUnique = prisma.poll.findUnique as jest.Mock;

describe("generatePollId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns an 8-character string", () => {
    expect(generatePollId()).toHaveLength(8);
  });

  it("only contains lowercase alphanumeric characters", () => {
    for (let i = 0; i < 20; i++) {
      expect(generatePollId()).toMatch(/^[a-z0-9]{8}$/);
    }
  });

  it("produces different codes across multiple calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generatePollId()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("generateUniquePollId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a unique code on first try when no collision", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const code = await generateUniquePollId();
    expect(code).toMatch(/^[a-z0-9]{8}$/);
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: code },
      select: { id: true },
    });
  });

  it("retries on collision and returns a code once available", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ id: "existing-1" })
      .mockResolvedValueOnce({ id: "existing-2" })
      .mockResolvedValueOnce(null);

    const code = await generateUniquePollId();
    expect(code).toMatch(/^[a-z0-9]{8}$/);
    expect(mockFindUnique).toHaveBeenCalledTimes(3);
  });

  it("throws after max retries when all codes collide", async () => {
    mockFindUnique.mockResolvedValue({ id: "always-exists" });
    await expect(generateUniquePollId()).rejects.toThrow(
      "Umfrage-ID-Generierung fehlgeschlagen nach mehreren Versuchen",
    );
    expect(mockFindUnique).toHaveBeenCalledTimes(5);
  });
});

describe("getPollTypeLabel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns "Termin" for "TERMIN"', () => {
    expect(getPollTypeLabel("TERMIN")).toBe("Termin");
  });

  it('returns "Sonstiges" for "SONSTIGES"', () => {
    expect(getPollTypeLabel("SONSTIGES")).toBe("Sonstiges");
  });

  it("returns the input as-is for unknown values", () => {
    expect(getPollTypeLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("getPollStatusLabel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns "Entwurf" for "DRAFT"', () => {
    expect(getPollStatusLabel("DRAFT")).toBe("Entwurf");
  });

  it('returns "Live" for "LIVE"', () => {
    expect(getPollStatusLabel("LIVE")).toBe("Live");
  });

  it('returns "Geschlossen" for "CLOSED"', () => {
    expect(getPollStatusLabel("CLOSED")).toBe("Geschlossen");
  });

  it("returns the input as-is for unknown values", () => {
    expect(getPollStatusLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});
