import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { EventFormModal } from "../components/event-form-modal";
import type { NewEvent } from "@/types";
import {
  createModalRenderer,
  includeSharedFormModalTests,
} from "./helpers/modal";

jest.mock("@/components/rich-text-editor", () => ({
  RichTextEditor: ({
    labelId,
    value,
    onChange,
    onBlur,
    disabled,
  }: {
    labelId: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    disabled?: boolean;
  }) => (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      aria-labelledby={labelId}
    />
  ),
}));

describe("EventFormModal", () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();
  const mockOnGeocode = jest.fn();

  const defaultEventData: NewEvent = {
    date: "2024-01-15",
    timeFrom: "10:00",
    timeTo: "12:00",
    location: "Vereinsheim",
    title: "",
    description: "Trainingstermin",
    latitude: "52.5200",
    longitude: "13.4050",
    type: "Training",
    cost: "",
    capacity: "",
    visibility: "PUBLIC",
  };

  const initialEventData: NewEvent = {
    date: "2024-01-20",
    timeFrom: "14:00",
    timeTo: "16:00",
    location: "Sportplatz",
    title: "",
    description: "Wettkampf",
    latitude: "51.3400",
    longitude: "12.3750",
    type: "Wettkampf",
    cost: "",
    capacity: "",
    visibility: "HIDDEN",
  };

  const { renderModal, modalElement } = createModalRenderer(EventFormModal, () => ({
    isOpen: true,
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
    isSubmitting: false,
    eventData: defaultEventData,
    setEventData: jest.fn(),
    isEditing: false,
    initialEventData: undefined,
  }));

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
    mockOnGeocode.mockClear();
  });

  describe("Create Mode", () => {
    it("should render create modal with correct title", () => {
      renderModal();
      expect(screen.getByText("Neuen Termin erstellen")).toBeInTheDocument();
    });

    it("should show 'Erstellen' button in create mode", () => {
      renderModal();
      expect(screen.getByRole("button", { name: "Erstellen" })).toBeInTheDocument();
    });

    it("should render button to copy data from last event in create mode", () => {
      renderModal({ onUseLastEvent: jest.fn() });
      expect(
        screen.getByRole("button", { name: "Daten vom letzten Termin übernehmen" })
      ).toBeInTheDocument();
    });

    it("should call callback when copy-last-event button is clicked", async () => {
      const mockCopyLastEvent = jest.fn();
      const user = userEvent.setup();
      renderModal({ onUseLastEvent: mockCopyLastEvent });

      await user.click(
        screen.getByRole("button", { name: "Daten vom letzten Termin übernehmen" })
      );

      expect(mockCopyLastEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edit Mode", () => {
    it("should render edit modal with correct title", () => {
      renderModal({ isEditing: true, initialEventData });
      expect(screen.getByText("Termin bearbeiten")).toBeInTheDocument();
    });

    it("should show 'Aktualisieren' button in edit mode", () => {
      renderModal({ isEditing: true, initialEventData });
      expect(screen.getByRole("button", { name: "Aktualisieren" })).toBeInTheDocument();
    });

    it("should not render button to copy data from last event in edit mode", () => {
      renderModal({ isEditing: true, initialEventData, onUseLastEvent: jest.fn() });
      expect(
        screen.queryByRole("button", { name: "Daten vom letzten Termin übernehmen" })
      ).not.toBeInTheDocument();
    });
  });

  describe("Form Fields", () => {
    it("should render all required fields with labels", () => {
      renderModal();
      expect(screen.getByLabelText(/Datum \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Uhrzeit von \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Uhrzeit bis \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Ort \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Beschreibung \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Breitengrad/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Längengrad/)).toBeInTheDocument();
    });

    it("should render type select with correct options", () => {
      renderModal();
      expect(screen.getByLabelText("Terminart")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Keine Terminart" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Training" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Wettkampf" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Lehrgang" })).toBeInTheDocument();
    });

    it("should offer cost as an optional free-text field", () => {
      renderModal();
      const costInput = screen.getByLabelText("Kosten");
      expect(costInput).toHaveValue("");
      expect(costInput).not.toBeRequired();
      expect(costInput).toHaveAttribute("type", "text");
    });

    it("should let the title be filled and left empty", async () => {
      const user = userEvent.setup();
      const setEventData = jest.fn();
      renderModal({ setEventData });

      const titleInput = screen.getByLabelText("Titel");
      expect(titleInput).toHaveValue("");
      expect(titleInput).not.toBeRequired();

      await user.type(titleInput, "L");

      expect(setEventData).toHaveBeenCalledWith(
        expect.objectContaining({ title: "L" })
      );
    });

    it("offers the three visibility levels and reports the chosen one", async () => {
      const user = userEvent.setup();
      const setEventData = jest.fn();
      renderModal({ setEventData });
      const select = screen.getByLabelText("Sichtbarkeitsstufe");
      expect(select).toHaveValue("PUBLIC");
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(
        expect.arrayContaining(["Öffentlich", "Nur für Mitglieder", "Verborgen"])
      );

      await user.selectOptions(select, "MEMBER");

      expect(setEventData).toHaveBeenCalledWith(expect.objectContaining({ visibility: "MEMBER" }));
    });

    it("should render geocode button", () => {
      renderModal({ onGeocode: mockOnGeocode });
      expect(screen.getByRole("button", { name: /📍 Koordinaten suchen/ })).toBeInTheDocument();
    });

    it("should render shooting range picker button", () => {
      renderModal({ onGeocode: mockOnGeocode });
      expect(screen.getByRole("button", { name: "Standort auswählen" })).toBeInTheDocument();
    });
  });

  describe("Geocoding", () => {
    it("should call onGeocode when geocode button is clicked", async () => {
      const user = userEvent.setup();
      renderModal({
        eventData: { ...defaultEventData, location: "Test Location" },
        onGeocode: mockOnGeocode,
      });

      await user.click(screen.getByRole("button", { name: /📍 Koordinaten suchen/ }));

      expect(mockOnGeocode).toHaveBeenCalledTimes(1);
    });

    it("should disable geocode button when location is too short", () => {
      renderModal({
        eventData: { ...defaultEventData, location: "AB" },
        onGeocode: mockOnGeocode,
      });

      expect(screen.getByRole("button", { name: /📍 Koordinaten suchen/ })).toBeDisabled();
    });

    it("should show success message when geocode succeeds", () => {
      renderModal({ geocodeSuccess: true });
      expect(screen.getAllByText(/Koordinaten automatisch gefunden/)).toHaveLength(2);
    });

    it("should apply green border to coordinate inputs when geocode succeeds", () => {
      renderModal({ geocodeSuccess: true });
      expect(screen.getByLabelText(/Breitengrad/)).toHaveClass("border-green-500");
      expect(screen.getByLabelText(/Längengrad/)).toHaveClass("border-green-500");
    });
  });

  describe("Geocoding Disabled State", () => {
    it("should disable geocode button when isGeocoding is true", () => {
      renderModal({ isGeocoding: true, onGeocode: mockOnGeocode });
      expect(screen.getByRole("button", { name: "Suche…" })).toBeDisabled();
    });
  });

  describe("Form Submission", () => {
    it("should not call onSubmit when form has validation errors - empty date", async () => {
      const user = userEvent.setup();
      renderModal({ eventData: { ...defaultEventData, date: "" } });

      await user.click(screen.getByRole("button", { name: "Erstellen" }));

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("Datum ist erforderlich")).toBeInTheDocument();
    });

    it("should not call onSubmit when form has validation errors - empty location", async () => {
      const user = userEvent.setup();
      renderModal({ eventData: { ...defaultEventData, location: "" } });

      await user.click(screen.getByRole("button", { name: "Erstellen" }));

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("Ort ist erforderlich")).toBeInTheDocument();
    });

    it("should not call onSubmit when form has validation errors - empty description", async () => {
      const user = userEvent.setup();
      renderModal({ eventData: { ...defaultEventData, description: "" } });

      await user.click(screen.getByRole("button", { name: "Erstellen" }));

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("Beschreibung ist erforderlich")).toBeInTheDocument();
    });

    it("should not call onSubmit when form has all required fields empty", async () => {
      const user = userEvent.setup();
      renderModal({
        eventData: {
          ...defaultEventData,
          date: "",
          timeFrom: "",
          timeTo: "",
          location: "",
          description: "",
          latitude: "",
          longitude: "",
          type: "",
        },
      });

      await user.click(screen.getByRole("button", { name: "Erstellen" }));

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByText("Datum ist erforderlich")).toBeInTheDocument();
      expect(screen.getByText("Ort ist erforderlich")).toBeInTheDocument();
      expect(screen.getByText("Beschreibung ist erforderlich")).toBeInTheDocument();
    });

    it("should clear validation state when modal is reopened", async () => {
      const user = userEvent.setup();
      const eventData = { ...defaultEventData, date: "" };
      const { rerender } = renderModal({ eventData });

      await user.click(screen.getByRole("button", { name: "Erstellen" }));
      expect(screen.getByText("Datum ist erforderlich")).toBeInTheDocument();

      rerender(modalElement({ eventData, isOpen: false }));
      rerender(modalElement({ eventData, isOpen: true }));

      expect(screen.queryByText("Datum ist erforderlich")).not.toBeInTheDocument();
    });
  });

  includeSharedFormModalTests({
    renderModal,
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
    dirtyEditProps: {
      eventData: { ...defaultEventData, location: "Changed Location" },
      isEditing: true,
      initialEventData,
    },
    cleanEditProps: {
      eventData: defaultEventData,
      isEditing: true,
      initialEventData: defaultEventData,
    },
    disabledWhenSubmitting: [/Ort/, /Breitengrad/, /Längengrad/, /Beschreibung/],
  });
});
