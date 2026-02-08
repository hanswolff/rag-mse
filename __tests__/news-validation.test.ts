import {
  validateTitle,
  validateContent,
  validateCreateNewsRequest,
  validateUpdateNewsRequest,
  type CreateNewsRequest,
  type UpdateNewsRequest,
} from "@/lib/news-validation";

describe("news-validation", () => {
  describe("validateTitle", () => {
    it("returns true for valid title", () => {
      expect(validateTitle("Test News")).toBe(true);
      expect(validateTitle("A")).toBe(true);
      expect(validateTitle("A".repeat(200))).toBe(true);
    });

    it("returns false for empty title", () => {
      expect(validateTitle("")).toBe(false);
    });

    it("returns false for whitespace-only title", () => {
      expect(validateTitle("   ")).toBe(false);
    });

    it("returns false for title exceeding max length", () => {
      expect(validateTitle("A".repeat(201))).toBe(false);
    });
  });

  describe("validateContent", () => {
    it("returns true for valid content", () => {
      expect(validateContent("Test content")).toBe(true);
      expect(validateContent("A")).toBe(true);
      expect(validateContent("A".repeat(10000))).toBe(true);
    });

    it("returns false for empty content", () => {
      expect(validateContent("")).toBe(false);
    });

    it("returns false for whitespace-only content", () => {
      expect(validateContent("   ")).toBe(false);
    });

    it("returns false for content exceeding max length", () => {
      expect(validateContent("A".repeat(10001))).toBe(false);
    });
  });

  describe("validateCreateNewsRequest", () => {
    const validRequest: CreateNewsRequest = {
      title: "Test News",
      content: "Test content for the news article",
    };

    it("returns valid for correct request", () => {
      const result = validateCreateNewsRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for request with published flag", () => {
      const request: CreateNewsRequest = {
        ...validRequest,
        published: true,
      };
      const result = validateCreateNewsRequest(request);
      expect(result.isValid).toBe(true);
    });

    it("returns error for missing title", () => {
      const request: CreateNewsRequest = {
        ...validRequest,
        title: "",
      };
      const result = validateCreateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Titel ist erforderlich");
    });

    it("returns error for title exceeding max length", () => {
      const request: CreateNewsRequest = {
        ...validRequest,
        title: "A".repeat(201),
      };
      const result = validateCreateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Titel muss zwischen 1 und 200 Zeichen lang sein"
      );
    });

    it("returns error for whitespace-only title", () => {
      const request: CreateNewsRequest = {
        ...validRequest,
        title: "   ",
      };
      const result = validateCreateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Titel muss zwischen 1 und 200 Zeichen lang sein"
      );
    });

    it("returns error for missing content", () => {
      const request: CreateNewsRequest = {
        ...validRequest,
        content: "",
      };
      const result = validateCreateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Inhalt ist erforderlich");
    });

    it("returns error for content exceeding max length", () => {
      const request: CreateNewsRequest = {
        ...validRequest,
        content: "A".repeat(10001),
      };
      const result = validateCreateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Inhalt muss zwischen 1 und 10000 Zeichen lang sein"
      );
    });

    it("returns error for whitespace-only content", () => {
      const request: CreateNewsRequest = {
        ...validRequest,
        content: "   ",
      };
      const result = validateCreateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Inhalt muss zwischen 1 und 10000 Zeichen lang sein"
      );
    });

    it("returns multiple errors for invalid request", () => {
      const request: CreateNewsRequest = {
        title: "",
        content: "",
      };
      const result = validateCreateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("validateUpdateNewsRequest", () => {
    it("returns valid for empty request", () => {
      const request: UpdateNewsRequest = {};
      const result = validateUpdateNewsRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for partial valid request", () => {
      const request: UpdateNewsRequest = {
        title: "Updated Title",
      };
      const result = validateUpdateNewsRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for updating published flag", () => {
      const request: UpdateNewsRequest = {
        published: false,
      };
      const result = validateUpdateNewsRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for multiple valid fields", () => {
      const request: UpdateNewsRequest = {
        title: "Updated Title",
        content: "Updated content",
        published: false,
      };
      const result = validateUpdateNewsRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns error for empty string title", () => {
      const request: UpdateNewsRequest = {
        title: "",
      };
      const result = validateUpdateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Titel muss zwischen 1 und 200 Zeichen lang sein"
      );
    });

    it("returns error for empty string content", () => {
      const request: UpdateNewsRequest = {
        content: "",
      };
      const result = validateUpdateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Inhalt muss zwischen 1 und 10000 Zeichen lang sein"
      );
    });

    it("returns error for title exceeding max length", () => {
      const request: UpdateNewsRequest = {
        title: "A".repeat(201),
      };
      const result = validateUpdateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Titel muss zwischen 1 und 200 Zeichen lang sein"
      );
    });

    it("returns error for whitespace-only title", () => {
      const request: UpdateNewsRequest = {
        title: "   ",
      };
      const result = validateUpdateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Titel muss zwischen 1 und 200 Zeichen lang sein"
      );
    });

    it("returns error for content exceeding max length", () => {
      const request: UpdateNewsRequest = {
        content: "A".repeat(10001),
      };
      const result = validateUpdateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Inhalt muss zwischen 1 und 10000 Zeichen lang sein"
      );
    });

    it("returns error for whitespace-only content", () => {
      const request: UpdateNewsRequest = {
        content: "   ",
      };
      const result = validateUpdateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Inhalt muss zwischen 1 und 10000 Zeichen lang sein"
      );
    });

    it("returns multiple errors for invalid request", () => {
      const request: UpdateNewsRequest = {
        title: "   ",
        content: "   ",
      };
      const result = validateUpdateNewsRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
