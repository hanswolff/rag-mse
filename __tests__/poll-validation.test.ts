import {
  validateCreatePollRequest,
  validateUpdatePollRequest,
  validateVoteRequest,
  POLL_TITLE_MAX_LENGTH,
  POLL_DESCRIPTION_MAX_LENGTH,
  POLL_OPTION_TEXT_MAX_LENGTH,
  POLL_OPTIONS_MIN,
  POLL_OPTIONS_MAX,
  CreatePollRequest,
  PollOptionInput,
} from "../lib/poll-validation";

function makeOptions(count: number, textOverride?: string): PollOptionInput[] {
  return Array.from({ length: count }, (_, i) => ({
    text: textOverride ?? `Option ${i + 1}`,
    position: i,
  }));
}

function validTerminRequest(overrides: Partial<CreatePollRequest> = {}): CreatePollRequest {
  return {
    title: "Schießtraining",
    type: "TERMIN",
    eventId: "event-123",
    options: makeOptions(3),
    ...overrides,
  };
}

function validSonstigesRequest(overrides: Partial<CreatePollRequest> = {}): CreatePollRequest {
  return {
    title: "Grillabend Planung",
    type: "SONSTIGES",
    options: makeOptions(2),
    ...overrides,
  };
}

describe("poll-validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── validateCreatePollRequest ──────────────────────────────────────

  describe("validateCreatePollRequest", () => {
    describe("valid requests", () => {
      it("should accept a valid TERMIN poll", () => {
        const result = validateCreatePollRequest(validTerminRequest());
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it("should accept a valid SONSTIGES poll without eventId", () => {
        const result = validateCreatePollRequest(validSonstigesRequest());
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it("should accept a poll with optional description", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ description: "Beschreibung" })
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it("should accept multipleChoice set to true", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ multipleChoice: true })
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it("should accept multipleChoice set to false", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ multipleChoice: false })
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it("should accept title at max length", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ title: "A".repeat(POLL_TITLE_MAX_LENGTH) })
        );
        expect(result.isValid).toBe(true);
      });

      it("should accept description at max length", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ description: "B".repeat(POLL_DESCRIPTION_MAX_LENGTH) })
        );
        expect(result.isValid).toBe(true);
      });

      it("should accept exactly min options", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ options: makeOptions(POLL_OPTIONS_MIN) })
        );
        expect(result.isValid).toBe(true);
      });

      it("should accept exactly max options", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ options: makeOptions(POLL_OPTIONS_MAX) })
        );
        expect(result.isValid).toBe(true);
      });

      it("should accept option text at max length", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({
            options: makeOptions(2, "X".repeat(POLL_OPTION_TEXT_MAX_LENGTH)),
          })
        );
        expect(result.isValid).toBe(true);
      });
    });

    describe("title validation", () => {
      it("should reject missing title", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ title: undefined as unknown as string })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Titel ist erforderlich");
      });

      it("should reject empty string title", () => {
        const result = validateCreatePollRequest(validTerminRequest({ title: "" }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Titel ist erforderlich");
      });

      it("should reject whitespace-only title", () => {
        const result = validateCreatePollRequest(validTerminRequest({ title: "   " }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Titel darf nicht leer sein");
      });

      it("should reject title exceeding max length", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ title: "A".repeat(POLL_TITLE_MAX_LENGTH + 1) })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          `Titel darf maximal ${POLL_TITLE_MAX_LENGTH} Zeichen lang sein`
        );
      });
    });

    describe("description validation", () => {
      it("should accept undefined description", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ description: undefined })
        );
        expect(result.isValid).toBe(true);
      });

      it("should accept empty string description", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ description: "" })
        );
        expect(result.isValid).toBe(true);
      });

      it("should reject description exceeding max length", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({
            description: "D".repeat(POLL_DESCRIPTION_MAX_LENGTH + 1),
          })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          `Beschreibung darf maximal ${POLL_DESCRIPTION_MAX_LENGTH} Zeichen lang sein`
        );
      });

      it("should reject non-string description", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ description: 42 as unknown as string })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Beschreibung muss ein Text sein");
      });
    });

    describe("type validation", () => {
      it("should reject missing type", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ type: undefined as unknown as string })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Typ ist erforderlich");
      });

      it("should reject empty string type", () => {
        const result = validateCreatePollRequest(validTerminRequest({ type: "" }));
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Typ ist erforderlich");
      });

      it("should reject invalid type value", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ type: "INVALID" })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Ungültiger Typ (muss Termin oder Sonstiges sein)"
        );
      });

      it("should reject lowercase termin", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ type: "termin" })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Ungültiger Typ (muss Termin oder Sonstiges sein)"
        );
      });
    });

    describe("type/eventId consistency", () => {
      it("should reject TERMIN without eventId", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ eventId: undefined })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Termin-ID ist erforderlich für den Typ Termin"
        );
      });

      it("should reject TERMIN with empty eventId", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ eventId: "" })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Termin-ID ist erforderlich für den Typ Termin"
        );
      });

      it("should reject SONSTIGES with eventId", () => {
        const result = validateCreatePollRequest(
          validSonstigesRequest({ eventId: "event-99" })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Termin-ID darf beim Typ Sonstiges nicht angegeben werden"
        );
      });
    });

    describe("multipleChoice validation", () => {
      it("should accept when multipleChoice is omitted", () => {
        const req = validTerminRequest();
        delete req.multipleChoice;
        const result = validateCreatePollRequest(req);
        expect(result.isValid).toBe(true);
      });

      it("should reject non-boolean multipleChoice", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ multipleChoice: "yes" as unknown as boolean })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Mehrfachauswahl muss true oder false sein");
      });

      it("should reject numeric multipleChoice", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ multipleChoice: 1 as unknown as boolean })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Mehrfachauswahl muss true oder false sein");
      });
    });

    describe("options validation", () => {
      it("should reject fewer than min options", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ options: makeOptions(POLL_OPTIONS_MIN - 1) })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          `Mindestens ${POLL_OPTIONS_MIN} Optionen sind erforderlich`
        );
      });

      it("should reject zero options", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ options: [] })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          `Mindestens ${POLL_OPTIONS_MIN} Optionen sind erforderlich`
        );
      });

      it("should reject more than max options", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ options: makeOptions(POLL_OPTIONS_MAX + 1) })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          `Maximal ${POLL_OPTIONS_MAX} Optionen sind erlaubt`
        );
      });

      it("should reject non-array options", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({ options: "not-array" as unknown as PollOptionInput[] })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Optionen müssen als Liste angegeben werden"
        );
      });

      it("should reject option with empty text", () => {
        const options = makeOptions(2);
        options[1].text = "";
        const result = validateCreatePollRequest(
          validTerminRequest({ options })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Option 2: Text ist erforderlich");
      });

      it("should reject option with whitespace-only text", () => {
        const options = makeOptions(2);
        options[0].text = "   ";
        const result = validateCreatePollRequest(
          validTerminRequest({ options })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Option 1: Text ist erforderlich");
      });

      it("should reject option text exceeding max length", () => {
        const options = makeOptions(2);
        options[0].text = "Z".repeat(POLL_OPTION_TEXT_MAX_LENGTH + 1);
        const result = validateCreatePollRequest(
          validTerminRequest({ options })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          `Option 1: Text darf maximal ${POLL_OPTION_TEXT_MAX_LENGTH} Zeichen lang sein`
        );
      });

      it("should reject null option object", () => {
        const result = validateCreatePollRequest(
          validTerminRequest({
            options: [null, { text: "Valid", position: 1 }] as unknown as PollOptionInput[],
          })
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Option 1: ungültiges Format");
      });
    });

    describe("multiple errors", () => {
      it("should collect errors from multiple fields", () => {
        const result = validateCreatePollRequest({
          title: "",
          type: "INVALID",
          options: [],
        } as unknown as CreatePollRequest);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  // ─── validateUpdatePollRequest ──────────────────────────────────────

  describe("validateUpdatePollRequest", () => {
    it("should accept a valid update with title only", () => {
      const result = validateUpdatePollRequest({ title: "Neuer Titel" });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should accept a valid update with options", () => {
      const result = validateUpdatePollRequest({ options: makeOptions(3) });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should accept a valid update with description", () => {
      const result = validateUpdatePollRequest({ description: "Neue Beschreibung" });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should accept an empty body (partial update)", () => {
      const result = validateUpdatePollRequest({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should accept multipleChoice update", () => {
      const result = validateUpdatePollRequest({ multipleChoice: true });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject title exceeding max length", () => {
      const result = validateUpdatePollRequest({
        title: "T".repeat(POLL_TITLE_MAX_LENGTH + 1),
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Titel darf maximal ${POLL_TITLE_MAX_LENGTH} Zeichen lang sein`
      );
    });

    it("should reject whitespace-only title", () => {
      const result = validateUpdatePollRequest({ title: "   " });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Titel darf nicht leer sein");
    });

    it("should reject empty string title", () => {
      const result = validateUpdatePollRequest({ title: "" });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Titel ist erforderlich");
    });

    it("should reject invalid options", () => {
      const result = validateUpdatePollRequest({ options: makeOptions(1) });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Mindestens ${POLL_OPTIONS_MIN} Optionen sind erforderlich`
      );
    });

    it("should reject description exceeding max length", () => {
      const result = validateUpdatePollRequest({
        description: "D".repeat(POLL_DESCRIPTION_MAX_LENGTH + 1),
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Beschreibung darf maximal ${POLL_DESCRIPTION_MAX_LENGTH} Zeichen lang sein`
      );
    });

    it("should reject non-boolean multipleChoice", () => {
      const result = validateUpdatePollRequest({
        multipleChoice: "true" as unknown as boolean,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Mehrfachauswahl muss true oder false sein");
    });

    it("should not validate options when omitted", () => {
      const result = validateUpdatePollRequest({ title: "Gültig" });
      expect(result.isValid).toBe(true);
    });
  });

  // ─── validateVoteRequest ────────────────────────────────────────────

  describe("validateVoteRequest", () => {
    it("should accept a single option for single-choice poll", () => {
      const result = validateVoteRequest(["opt-1"], false);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should accept multiple options for multiple-choice poll", () => {
      const result = validateVoteRequest(["opt-1", "opt-2", "opt-3"], true);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should accept a single option for multiple-choice poll", () => {
      const result = validateVoteRequest(["opt-1"], true);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject empty optionIds array", () => {
      const result = validateVoteRequest([], false);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Mindestens eine Option muss gewählt werden");
    });

    it("should reject non-array optionIds", () => {
      const result = validateVoteRequest("opt-1", false);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("optionIds muss eine Liste sein");
    });

    it("should reject null optionIds", () => {
      const result = validateVoteRequest(null, false);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("optionIds muss eine Liste sein");
    });

    it("should reject undefined optionIds", () => {
      const result = validateVoteRequest(undefined, false);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("optionIds muss eine Liste sein");
    });

    it("should reject multiple options for single-choice poll", () => {
      const result = validateVoteRequest(["opt-1", "opt-2"], false);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Bei Einzelauswahl darf nur eine Option gewählt werden"
      );
    });

    it("should reject non-string option IDs", () => {
      const result = validateVoteRequest([123, 456], true);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültige Options-ID");
    });

    it("should reject empty string option ID", () => {
      const result = validateVoteRequest([""], false);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültige Options-ID");
    });

    it("should reject whitespace-only option ID", () => {
      const result = validateVoteRequest(["   "], false);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültige Options-ID");
    });

    it("should reject duplicate option IDs", () => {
      const result = validateVoteRequest(["opt-1", "opt-1"], true);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Jede Option darf nur einmal gewählt werden");
    });

    it("should reject object as optionIds", () => {
      const result = validateVoteRequest({ id: "opt-1" }, false);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("optionIds muss eine Liste sein");
    });

    it("should report both empty and multiple-choice violations", () => {
      const result = validateVoteRequest([], true);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Mindestens eine Option muss gewählt werden");
    });
  });
});
