import {
  parsePageNumber,
  parsePageSize,
  parseSortField,
  parseSortDirection,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  DOCUMENT_SORT_FIELDS,
} from "@/lib/document-query";

describe("document-query", () => {
  describe("parsePageNumber", () => {
    it("returns 1 for null input", () => {
      expect(parsePageNumber(null)).toBe(1);
    });

    it("returns 1 for empty string", () => {
      expect(parsePageNumber("")).toBe(1);
    });

    it("returns 1 for non-numeric input", () => {
      expect(parsePageNumber("abc")).toBe(1);
    });

    it("returns 1 for zero", () => {
      expect(parsePageNumber("0")).toBe(1);
    });

    it("returns 1 for negative numbers", () => {
      expect(parsePageNumber("-5")).toBe(1);
    });

    it("returns parsed value for valid positive integers", () => {
      expect(parsePageNumber("1")).toBe(1);
      expect(parsePageNumber("10")).toBe(10);
      expect(parsePageNumber("100")).toBe(100);
    });

    it("ignores decimal parts", () => {
      expect(parsePageNumber("3.5")).toBe(3);
    });
  });

  describe("parsePageSize", () => {
    it(`returns ${DEFAULT_PAGE_SIZE} for null input`, () => {
      expect(parsePageSize(null)).toBe(DEFAULT_PAGE_SIZE);
    });

    it(`returns ${DEFAULT_PAGE_SIZE} for empty string`, () => {
      expect(parsePageSize("")).toBe(DEFAULT_PAGE_SIZE);
    });

    it(`returns ${DEFAULT_PAGE_SIZE} for non-numeric input`, () => {
      expect(parsePageSize("abc")).toBe(DEFAULT_PAGE_SIZE);
    });

    it(`returns ${DEFAULT_PAGE_SIZE} for zero`, () => {
      expect(parsePageSize("0")).toBe(DEFAULT_PAGE_SIZE);
    });

    it(`returns ${DEFAULT_PAGE_SIZE} for negative numbers`, () => {
      expect(parsePageSize("-5")).toBe(DEFAULT_PAGE_SIZE);
    });

    it("returns parsed value for valid positive integers under max", () => {
      expect(parsePageSize("10")).toBe(10);
      expect(parsePageSize("50")).toBe(50);
    });

    it(`clamps to ${MAX_PAGE_SIZE} when exceeding max`, () => {
      expect(parsePageSize("200")).toBe(MAX_PAGE_SIZE);
      expect(parsePageSize("1000")).toBe(MAX_PAGE_SIZE);
    });

    it(`accepts exactly ${MAX_PAGE_SIZE}`, () => {
      expect(parsePageSize("100")).toBe(100);
    });
  });

  describe("parseSortField", () => {
    it("returns 'documentDate' for null input", () => {
      expect(parseSortField(null)).toBe("documentDate");
    });

    it("returns 'documentDate' for empty string", () => {
      expect(parseSortField("")).toBe("documentDate");
    });

    it("returns 'documentDate' for invalid field", () => {
      expect(parseSortField("invalid")).toBe("documentDate");
    });

    it("returns valid field when provided", () => {
      expect(parseSortField("displayName")).toBe("displayName");
      expect(parseSortField("documentDate")).toBe("documentDate");
      expect(parseSortField("updatedAt")).toBe("updatedAt");
      expect(parseSortField("mimeType")).toBe("mimeType");
      expect(parseSortField("sizeBytes")).toBe("sizeBytes");
    });

    it("is case-sensitive", () => {
      expect(parseSortField("DisplayName")).toBe("documentDate");
      expect(parseSortField("DISPLAYNAME")).toBe("documentDate");
    });
  });

  describe("parseSortDirection", () => {
    it("returns 'desc' for null input", () => {
      expect(parseSortDirection(null)).toBe("desc");
    });

    it("returns 'desc' for empty string", () => {
      expect(parseSortDirection("")).toBe("desc");
    });

    it("returns 'asc' for 'asc'", () => {
      expect(parseSortDirection("asc")).toBe("asc");
    });

    it("returns 'desc' for 'desc'", () => {
      expect(parseSortDirection("desc")).toBe("desc");
    });

    it("returns 'desc' for any other value", () => {
      expect(parseSortDirection("ascending")).toBe("desc");
      expect(parseSortDirection("DESC")).toBe("desc");
      expect(parseSortDirection("invalid")).toBe("desc");
    });
  });

  describe("constants", () => {
    it("exports MAX_PAGE_SIZE as 100", () => {
      expect(MAX_PAGE_SIZE).toBe(100);
    });

    it("exports DEFAULT_PAGE_SIZE as 20", () => {
      expect(DEFAULT_PAGE_SIZE).toBe(20);
    });

    it("exports expected sort fields", () => {
      expect(DOCUMENT_SORT_FIELDS).toEqual([
        "displayName",
        "documentDate",
        "updatedAt",
        "mimeType",
        "sizeBytes",
      ]);
    });
  });
});
