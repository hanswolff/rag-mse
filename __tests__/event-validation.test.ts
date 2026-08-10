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

    it("returns false for single-digit hours (requires leading zero)", () => {
      expect(validateTimeString("9:30")).toBe(false);
      expect(validateTimeString("1:00")).toBe(false);
    });

    it("returns true for double-digit hours with leading zero", () => {
      expect(validateTimeString("09:30")).toBe(true);
      expect(validateTimeString("01:00")).toBe(true);
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

    it("accepts an event without a title", () => {
      const result = validateCreateEventRequest(validRequest);
      expect(result.isValid).toBe(true);
    });

    it("accepts an empty title as not set", () => {
      const result = validateCreateEventRequest({ ...validRequest, title: "" });
      expect(result.isValid).toBe(true);
    });

    it("accepts a title within the length limit", () => {
      const result = validateCreateEventRequest({
        ...validRequest,
        title: "Dynamisches Pistolenschießen Level 1",
      });
      expect(result.isValid).toBe(true);
    });

    it("rejects a title longer than 200 characters", () => {
      const result = validateCreateEventRequest({ ...validRequest, title: "a".repeat(201) });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Titel darf maximal 200 Zeichen haben");
    });

    it("accepts a cost note", () => {
      const result = validateCreateEventRequest({
        ...validRequest,
        cost: "25 € für Mitglieder, 40 € für Gäste",
      });
      expect(result.isValid).toBe(true);
    });

    it("accepts an empty cost note as not set", () => {
      const result = validateCreateEventRequest({ ...validRequest, cost: "" });
      expect(result.isValid).toBe(true);
    });

    it("rejects a cost note longer than 100 characters", () => {
      const result = validateCreateEventRequest({ ...validRequest, cost: "a".repeat(101) });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Kosten dürfen maximal 100 Zeichen haben");
    });

    it("accepts cost and Plätze for every Terminart", () => {
      for (const type of ["Training", "Wettkampf", "Lehrgang", ""]) {
        const result = validateCreateEventRequest({
          ...validRequest,
          type,
          cost: "kostenfrei",
        });
        expect(result.isValid).toBe(true);
      }
    });

    it("accepts a positive integer as capacity", () => {
      const result = validateCreateEventRequest({ ...validRequest, capacity: 12 });
      expect(result.isValid).toBe(true);
    });

    it("accepts a numeric string as capacity", () => {
      const result = validateCreateEventRequest({ ...validRequest, capacity: "12" });
      expect(result.isValid).toBe(true);
    });

    it("accepts an empty capacity as not set", () => {
      const result = validateCreateEventRequest({ ...validRequest, capacity: "" });
      expect(result.isValid).toBe(true);
    });

    it.each([0, -1, 1.5, "0", "-3", "2,5", "zwölf"])(
      "rejects %p as capacity",
      (capacity) => {
        const result = validateCreateEventRequest({ ...validRequest, capacity });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Plätze müssen eine positive ganze Zahl sein");
      }
    );

    // Der JSON-Body ist ungeprüfte Fremdeingabe: Vor dieser Prüfung machte ein
    // String(...) aus einem Objekt klaglos den Wert "[object Object]" und
    // schrieb ihn in die Datenbank, und ein Objekt als Terminart ließ
    // validateEventType über .trim() abstürzen — also 500 statt 400.
    it.each([
      ["title", { boese: true }, "Titel muss ein Text sein"],
      ["title", [1, 2], "Titel muss ein Text sein"],
      ["title", 42, "Titel muss ein Text sein"],
      ["cost", { boese: true }, "Kosten müssen als Text angegeben werden"],
      ["cost", 25, "Kosten müssen als Text angegeben werden"],
    ])("rejects %s given as %p instead of text", (field, value, message) => {
      const result = validateCreateEventRequest({
        ...validRequest,
        [field as string]: value,
      } as unknown as CreateEventRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(message);
      expect(result.fieldErrors).toContainEqual({ field, message });
    });

    it.each([{ boese: true }, [1, 2], 42, true])(
      "rejects %p as type instead of crashing",
      (type) => {
        const result = validateCreateEventRequest({
          ...validRequest,
          type,
        } as unknown as CreateEventRequest);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Ungültiger Typ (muss Training, Wettkampf, Lehrgang oder leer sein)"
        );
      }
    );

    it("returns valid for Lehrgang type", () => {
      const request: CreateEventRequest = {
        ...validRequest,
        type: "Lehrgang",
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
      expect(result.errors).toContain("Ungültiger Typ (muss Training, Wettkampf, Lehrgang oder leer sein)");
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

    it("accepts clearing the title", () => {
      const result = validateUpdateEventRequest({ title: "" });
      expect(result.isValid).toBe(true);
    });

    it("rejects a title longer than 200 characters", () => {
      const result = validateUpdateEventRequest({ title: "a".repeat(201) });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Titel darf maximal 200 Zeichen haben");
    });

    it("accepts clearing the cost note", () => {
      const result = validateUpdateEventRequest({ cost: "" });
      expect(result.isValid).toBe(true);
    });

    it("rejects a cost note longer than 100 characters", () => {
      const result = validateUpdateEventRequest({ cost: "a".repeat(101) });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Kosten dürfen maximal 100 Zeichen haben");
    });

    it("accepts clearing the capacity", () => {
      const result = validateUpdateEventRequest({ capacity: "" });
      expect(result.isValid).toBe(true);
    });

    // Ein explizites null heißt "Feld leeren" und bleibt erlaubt; alles andere,
    // was kein Text ist, wird abgelehnt statt stillschweigend umgewandelt.
    it.each([
      ["title", null, true],
      ["cost", null, true],
      ["title", { boese: true }, false],
      ["cost", { boese: true }, false],
    ])("update: %s as %p is accepted=%s", (field, value, expected) => {
      const result = validateUpdateEventRequest({
        [field as string]: value,
      } as unknown as UpdateEventRequest);
      expect(result.isValid).toBe(expected);
    });

    it("rejects a non-positive capacity", () => {
      const result = validateUpdateEventRequest({ capacity: 0 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Plätze müssen eine positive ganze Zahl sein");
    });

    it("returns valid for Lehrgang type", () => {
      const request: UpdateEventRequest = {
        type: "Lehrgang",
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
      expect(result.errors).toContain("Ungültiger Typ (muss Training, Wettkampf, Lehrgang oder leer sein)");
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
