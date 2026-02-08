import {
  validateDateTime,
  validateTimeString,
  validateLocation,
  validateDescription,
  validateCoordinate,
  validateLongitude,
  validateCreateEventRequest,
  validateUpdateEventRequest,
  validateVote,
  type CreateEventRequest,
  type UpdateEventRequest,
} from "@/lib/event-validation";
import { VoteType } from "@prisma/client";
import { MAX_EVENT_DESCRIPTION_BYTES } from "@/lib/event-description";

describe("event-validation", () => {
  describe("validateDateTime", () => {
    it("returns true for valid date and time", () => {
      expect(validateDateTime("2024-12-25", "14:30")).toBe(true);
    });

    it("returns true for valid date without time check", () => {
      expect(validateDateTime("2024-12-25", "12:00")).toBe(true);
    });

    it("returns false for empty date", () => {
      expect(validateDateTime("", "14:30")).toBe(false);
    });

    it("returns false for empty time", () => {
      expect(validateDateTime("2024-12-25", "")).toBe(false);
    });

    it("returns false for invalid date", () => {
      expect(validateDateTime("invalid", "14:30")).toBe(false);
    });

    it("returns false for invalid time format", () => {
      expect(validateDateTime("2024-12-25", "invalid")).toBe(false);
    });
  });

  describe("validateTimeString", () => {
    it("returns true for valid 24-hour time format", () => {
      expect(validateTimeString("00:00")).toBe(true);
      expect(validateTimeString("12:30")).toBe(true);
      expect(validateTimeString("23:59")).toBe(true);
    });

    it("returns true for single-digit hours", () => {
      expect(validateTimeString("9:30")).toBe(true);
      expect(validateTimeString("1:00")).toBe(true);
    });

    it("returns false for invalid time", () => {
      expect(validateTimeString("24:00")).toBe(false);
      expect(validateTimeString("12:60")).toBe(false);
      expect(validateTimeString("12:3")).toBe(false);
      expect(validateTimeString("invalid")).toBe(false);
    });

    it("returns false for empty time", () => {
      expect(validateTimeString("")).toBe(false);
    });
  });

  describe("validateLocation", () => {
    it("returns true for non-empty location", () => {
      expect(validateLocation("Vereinsheim")).toBe(true);
      expect(validateLocation("Sportplatz")).toBe(true);
    });

    it("returns false for empty location", () => {
      expect(validateLocation("")).toBe(false);
    });

    it("returns false for whitespace-only location", () => {
      expect(validateLocation("   ")).toBe(false);
    });
  });

  describe("validateDescription", () => {
    it("returns true for non-empty description", () => {
      expect(validateDescription("Jahreshauptversammlung")).toBe(true);
    });

    it("returns false for empty description", () => {
      expect(validateDescription("")).toBe(false);
    });

    it("returns false for whitespace-only description", () => {
      expect(validateDescription("   ")).toBe(false);
    });

    it("returns true for description at max byte size", () => {
      const description = "a".repeat(MAX_EVENT_DESCRIPTION_BYTES);
      expect(validateDescription(description)).toBe(true);
    });

    it("returns false for description exceeding max byte size", () => {
      const description = "a".repeat(MAX_EVENT_DESCRIPTION_BYTES + 1);
      expect(validateDescription(description)).toBe(false);
    });

    it("returns true for description close to max byte size", () => {
      const description = "a".repeat(MAX_EVENT_DESCRIPTION_BYTES - 1);
      expect(validateDescription(description)).toBe(true);
    });
  });

  describe("validateCoordinate", () => {
    it("returns true for valid latitude values", () => {
      expect(validateCoordinate("0")).toBe(true);
      expect(validateCoordinate("45")).toBe(true);
      expect(validateCoordinate("90")).toBe(true);
      expect(validateCoordinate("-90")).toBe(true);
      expect(validateCoordinate("52.5200")).toBe(true);
    });

    it("returns true for empty string", () => {
      expect(validateCoordinate("")).toBe(true);
    });

    it("returns true for whitespace-only string", () => {
      expect(validateCoordinate("   ")).toBe(true);
    });

    it("returns false for invalid latitude > 90", () => {
      expect(validateCoordinate("90.1")).toBe(false);
      expect(validateCoordinate("100")).toBe(false);
    });

    it("returns false for invalid latitude < -90", () => {
      expect(validateCoordinate("-90.1")).toBe(false);
      expect(validateCoordinate("-100")).toBe(false);
    });

    it("returns false for non-numeric values", () => {
      expect(validateCoordinate("invalid")).toBe(false);
      expect(validateCoordinate("abc")).toBe(false);
    });
  });

  describe("validateLongitude", () => {
    it("returns true for valid longitude values", () => {
      expect(validateLongitude("0")).toBe(true);
      expect(validateLongitude("90")).toBe(true);
      expect(validateLongitude("180")).toBe(true);
      expect(validateLongitude("-180")).toBe(true);
      expect(validateLongitude("13.4050")).toBe(true);
    });

    it("returns true for empty string", () => {
      expect(validateLongitude("")).toBe(true);
    });

    it("returns true for whitespace-only string", () => {
      expect(validateLongitude("   ")).toBe(true);
    });

    it("returns false for invalid longitude > 180", () => {
      expect(validateLongitude("180.1")).toBe(false);
      expect(validateLongitude("200")).toBe(false);
    });

    it("returns false for invalid longitude < -180", () => {
      expect(validateLongitude("-180.1")).toBe(false);
      expect(validateLongitude("-200")).toBe(false);
    });

    it("returns false for non-numeric values", () => {
      expect(validateLongitude("invalid")).toBe(false);
      expect(validateLongitude("abc")).toBe(false);
    });
  });

  describe("validateCreateEventRequest", () => {
    const validRequest: CreateEventRequest = {
      date: "2024-12-25",
      timeFrom: "14:00",
      timeTo: "16:00",
      location: "Vereinsheim",
      description: "Jahreshauptversammlung",
    };

    it("returns valid for correct request", () => {
      const result = validateCreateEventRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns error for missing date", () => {
      const request = { ...validRequest, date: "" };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Datum ist erforderlich");
    });

    it("returns error for invalid date", () => {
      const request = { ...validRequest, date: "invalid" };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiges Datumsformat");
    });

    it("returns error for missing timeFrom", () => {
      const request = { ...validRequest, timeFrom: "" };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Uhrzeit von ist erforderlich");
    });

    it("returns error for invalid timeFrom format", () => {
      const request = { ...validRequest, timeFrom: "25:00" };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiges Zeitformat für Uhrzeit von");
    });

    it("returns error for missing timeTo", () => {
      const request = { ...validRequest, timeTo: "" };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Uhrzeit bis ist erforderlich");
    });

    it("returns error for invalid timeTo format", () => {
      const request = { ...validRequest, timeTo: "25:00" };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiges Zeitformat für Uhrzeit bis");
    });

    it("returns error when timeFrom equals timeTo", () => {
      const request = { ...validRequest, timeFrom: "14:00", timeTo: "14:00" };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Uhrzeit bis muss nach Uhrzeit von liegen");
    });

    it("returns error when timeFrom is after timeTo", () => {
      const request = { ...validRequest, timeFrom: "16:00", timeTo: "14:00" };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Uhrzeit bis muss nach Uhrzeit von liegen");
    });

    it("returns error for missing location", () => {
      const request = { ...validRequest, location: "" };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ort ist erforderlich");
    });

    it("returns error for whitespace-only location", () => {
      const request = { ...validRequest, location: "   " };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ort darf nicht leer sein");
    });

    it("returns error for missing description", () => {
      const request = { ...validRequest, description: "" };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Beschreibung ist erforderlich");
    });

    it("returns error for whitespace-only description", () => {
      const request = { ...validRequest, description: "   " };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Beschreibung darf nicht leer sein");
    });

    it("returns error for description exceeding max byte size", () => {
      const request = { ...validRequest, description: "a".repeat(MAX_EVENT_DESCRIPTION_BYTES + 1) };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Beschreibung darf maximal ${MAX_EVENT_DESCRIPTION_BYTES.toLocaleString("de-DE")} Bytes haben`);
    });

    it("returns valid for description at max byte size", () => {
      const request = { ...validRequest, description: "a".repeat(MAX_EVENT_DESCRIPTION_BYTES) };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for description close to max byte size", () => {
      const request = { ...validRequest, description: "a".repeat(MAX_EVENT_DESCRIPTION_BYTES - 1) };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns multiple errors for invalid request", () => {
      const request: CreateEventRequest = {
        date: "",
        timeFrom: "25:00",
        timeTo: "14:00",
        location: "",
        description: "",
      };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it("returns valid for request with valid coordinates", () => {
      const request: CreateEventRequest = {
        ...validRequest,
        latitude: "52.5200",
        longitude: "13.4050",
      };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for request with empty coordinates", () => {
      const request: CreateEventRequest = {
        ...validRequest,
        latitude: "",
        longitude: "",
      };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns error for invalid latitude > 90", () => {
      const request: CreateEventRequest = {
        ...validRequest,
        latitude: "91",
        longitude: "13.4050",
      };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiger Breitengrad (muss zwischen -90 und 90 liegen)");
    });

    it("returns error for invalid longitude > 180", () => {
      const request: CreateEventRequest = {
        ...validRequest,
        latitude: "52.5200",
        longitude: "181",
      };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiger Längengrad (muss zwischen -180 und 180 liegen)");
    });

    it("returns multiple coordinate errors", () => {
      const request: CreateEventRequest = {
        ...validRequest,
        latitude: "100",
        longitude: "200",
      };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiger Breitengrad (muss zwischen -90 und 90 liegen)");
      expect(result.errors).toContain("Ungültiger Längengrad (muss zwischen -180 und 180 liegen)");
    });

    it("returns valid for Training type", () => {
      const request: CreateEventRequest = {
        ...validRequest,
        type: "Training",
      };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for Wettkampf type", () => {
      const request: CreateEventRequest = {
        ...validRequest,
        type: "Wettkampf",
      };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for empty type", () => {
      const request: CreateEventRequest = {
        ...validRequest,
        type: "",
      };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns error for invalid type", () => {
      const request: CreateEventRequest = {
        ...validRequest,
        type: "InvalidType",
      };
      const result = validateCreateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiger Typ (muss Training, Wettkampf oder leer sein)");
    });
  });

  describe("validateUpdateEventRequest", () => {
    it("returns valid for empty request", () => {
      const request: UpdateEventRequest = {};
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for partial valid request", () => {
      const request: UpdateEventRequest = {
        location: "Neuer Ort",
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns error for empty string fields", () => {
      const request: UpdateEventRequest = {
        date: "",
        location: "",
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiges Datumsformat");
      expect(result.errors).toContain("Ort darf nicht leer sein");
    });

    it("returns error for invalid date", () => {
      const request: UpdateEventRequest = {
        date: "invalid",
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiges Datumsformat");
    });

    it("returns error for impossible date", () => {
      const request: UpdateEventRequest = {
        date: "2024-02-30",
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiges Datumsformat");
    });

    it("returns error for invalid timeFrom", () => {
      const request: UpdateEventRequest = {
        timeFrom: "25:00",
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiges Zeitformat für Uhrzeit von");
    });

    it("returns error for invalid timeTo", () => {
      const request: UpdateEventRequest = {
        timeTo: "25:00",
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiges Zeitformat für Uhrzeit bis");
    });

    it("returns error for whitespace-only location", () => {
      const request: UpdateEventRequest = {
        location: "   ",
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ort darf nicht leer sein");
    });

    it("returns error for whitespace-only description", () => {
      const request: UpdateEventRequest = {
        description: "   ",
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Beschreibung darf nicht leer sein");
    });

    it("returns error for description exceeding max byte size", () => {
      const request: UpdateEventRequest = {
        description: "a".repeat(MAX_EVENT_DESCRIPTION_BYTES + 1),
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Beschreibung darf maximal ${MAX_EVENT_DESCRIPTION_BYTES.toLocaleString("de-DE")} Bytes haben`);
    });

    it("returns valid for description at max byte size", () => {
      const request: UpdateEventRequest = {
        description: "a".repeat(MAX_EVENT_DESCRIPTION_BYTES),
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for description close to max byte size", () => {
      const request: UpdateEventRequest = {
        description: "a".repeat(MAX_EVENT_DESCRIPTION_BYTES - 1),
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns error for non-string description", () => {
      const request: UpdateEventRequest = {
        description: null as unknown as string,
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Beschreibung muss ein Text sein");
    });

    it("returns valid for Training type", () => {
      const request: UpdateEventRequest = {
        type: "Training",
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for Wettkampf type", () => {
      const request: UpdateEventRequest = {
        type: "Wettkampf",
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for empty type", () => {
      const request: UpdateEventRequest = {
        type: "",
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns error for invalid type", () => {
      const request: UpdateEventRequest = {
        type: "InvalidType",
      };
      const result = validateUpdateEventRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiger Typ (muss Training, Wettkampf oder leer sein)");
    });
  });

  describe("validateVote", () => {
    it("returns true for valid JA vote", () => {
      expect(validateVote("JA")).toBe(true);
    });

    it("returns true for valid NEIN vote", () => {
      expect(validateVote("NEIN")).toBe(true);
    });

    it("returns true for valid VIELLEICHT vote", () => {
      expect(validateVote("VIELLEICHT")).toBe(true);
    });

    it("returns false for invalid vote", () => {
      expect(validateVote("MAYBE")).toBe(false);
      expect(validateVote("YES")).toBe(false);
      expect(validateVote("")).toBe(false);
    });

    it("type guards properly for VoteType", () => {
      const validVote = "JA";
      if (validateVote(validVote)) {
        const vote: VoteType = validVote;
        expect(vote).toBe(VoteType.JA);
      }
    });
  });
});
