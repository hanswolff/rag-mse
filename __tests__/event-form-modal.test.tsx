import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { EventFormModal } from "../components/event-form-modal";
import type { NewEvent } from "@/types";

jest.mock("@/components/rich-text-editor", () => ({
  RichTextEditor: ({
    id,
    value,
    onChange,
    onBlur,
    disabled,
  }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    disabled?: boolean;
  }) => (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      aria-label="Beschreibung *"
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
    description: "Trainingstermin",
    latitude: "52.5200",
    longitude: "13.4050",
    type: "Training",
    visible: true,
  };

  const initialEventData: NewEvent = {
    date: "2024-01-20",
    timeFrom: "14:00",
    timeTo: "16:00",
    location: "Sportplatz",
    description: "Wettkampf",
    latitude: "51.3400",
    longitude: "12.3750",
    type: "Wettkampf",
    visible: false,
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
    mockOnGeocode.mockClear();
    window.confirm = jest.fn(() => true);
  });

  describe("Create Mode", () => {
    it("should render create modal with correct title", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      expect(screen.getByText("Neuen Termin erstellen")).toBeInTheDocument();
    });

    it("should show 'Erstellen' button in create mode", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      expect(screen.getByRole("button", { name: "Erstellen" })).toBeInTheDocument();
    });
  });

  describe("Edit Mode", () => {
    it("should render edit modal with correct title", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={true}
          initialEventData={initialEventData}
        />
      );

      expect(screen.getByText("Termin bearbeiten")).toBeInTheDocument();
    });

    it("should show 'Aktualisieren' button in edit mode", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={true}
          initialEventData={initialEventData}
        />
      );

      expect(screen.getByRole("button", { name: "Aktualisieren" })).toBeInTheDocument();
    });
  });

  describe("Form Fields", () => {
    it("should render all required fields with labels", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      expect(screen.getByLabelText(/Datum \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Uhrzeit von \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Uhrzeit bis \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Ort \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Beschreibung \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Breitengrad/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Längengrad/)).toBeInTheDocument();
    });

    it("should render type select with correct options", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      expect(screen.getByRole("option", { name: "Kein Typ" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Training" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Wettkampf" })).toBeInTheDocument();
    });

    it("should render visibility checkbox", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      const checkbox = screen.getByLabelText(/Termin sichtbar/);
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toBeChecked();
    });

    it("should render geocode button", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
          onGeocode={mockOnGeocode}
        />
      );

      expect(screen.getByRole("button", { name: /📍 Koordinaten suchen/ })).toBeInTheDocument();
    });

    it("should render shooting range picker button", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
          onGeocode={mockOnGeocode}
        />
      );

      expect(screen.getByRole("button", { name: "Schießstand auswählen" })).toBeInTheDocument();
    });
  });

  describe("Geocoding", () => {
    it("should call onGeocode when geocode button is clicked", async () => {
      const setEventData = jest.fn();
      const user = userEvent.setup();

      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={{ ...defaultEventData, location: "Test Location" }}
          setEventData={setEventData}
          isEditing={false}
          initialEventData={undefined}
          onGeocode={mockOnGeocode}
        />
      );

      const geocodeButton = screen.getByRole("button", { name: /📍 Koordinaten suchen/ });
      await user.click(geocodeButton);

      expect(mockOnGeocode).toHaveBeenCalledTimes(1);
    });

    it("should disable geocode button when location is too short", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={{ ...defaultEventData, location: "AB" }}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
          onGeocode={mockOnGeocode}
        />
      );

      const geocodeButton = screen.getByRole("button", { name: /📍 Koordinaten suchen/ });
      expect(geocodeButton).toBeDisabled();
    });

    it("should show success message when geocode succeeds", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
          geocodeSuccess={true}
        />
      );

      expect(screen.getAllByText(/Koordinaten automatisch gefunden/)).toHaveLength(2);
    });

    it("should apply green border to coordinate inputs when geocode succeeds", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
          geocodeSuccess={true}
        />
      );

      const latitudeInput = screen.getByLabelText(/Breitengrad/);
      const longitudeInput = screen.getByLabelText(/Längengrad/);

      expect(latitudeInput).toHaveClass("border-green-500");
      expect(longitudeInput).toHaveClass("border-green-500");
    });
  });

  describe("Unsaved Changes Confirmation", () => {
    it("should show confirmation dialog when closing with unsaved changes", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={{ ...defaultEventData, location: "Changed Location" }}
          setEventData={jest.fn()}
          isEditing={true}
          initialEventData={initialEventData}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
      fireEvent.click(cancelButton);

      expect(window.confirm).toHaveBeenCalledWith(
        "Sie haben ungespeicherte Änderungen. Wirklich schließen?"
      );
    });

    it("should close modal without confirmation when no unsaved changes", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={true}
          initialEventData={defaultEventData}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
      fireEvent.click(cancelButton);

      expect(window.confirm).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should not close when user cancels confirmation dialog", () => {
      window.confirm = jest.fn(() => false);

      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={{ ...defaultEventData, location: "Changed Location" }}
          setEventData={jest.fn()}
          isEditing={true}
          initialEventData={initialEventData}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
      fireEvent.click(cancelButton);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Disabled State", () => {
    it("should disable all inputs when isSubmitting is true", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      const locationInput = screen.getByLabelText(/Ort/);
      const latitudeInput = screen.getByLabelText(/Breitengrad/);
      const longitudeInput = screen.getByLabelText(/Längengrad/);
      const descriptionInput = screen.getByLabelText(/Beschreibung/);

      expect(locationInput).toBeDisabled();
      expect(latitudeInput).toBeDisabled();
      expect(longitudeInput).toBeDisabled();
      expect(descriptionInput).toBeDisabled();
    });

    it("should show 'Wird gespeichert...' text when isSubmitting is true", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      expect(screen.getByText("Wird gespeichert...")).toBeInTheDocument();
    });

    it("should disable submit button when isSubmitting is true", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Wird gespeichert..." });
      expect(submitButton).toBeDisabled();
    });

    it("should disable cancel button when isSubmitting is true", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
      expect(cancelButton).toBeDisabled();
    });

    it("should disable geocode button when isGeocoding is true", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
          isGeocoding={true}
          onGeocode={mockOnGeocode}
        />
      );

      const geocodeButton = screen.getByRole("button", { name: "Suche..." });
      expect(geocodeButton).toBeDisabled();
    });
  });

  describe("General Errors", () => {
    it("should display general error when errors.general is provided", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
          errors={{ general: "Ein allgemeiner Fehler ist aufgetreten" }}
        />
      );

      expect(screen.getByText("Ein allgemeiner Fehler ist aufgetreten")).toBeInTheDocument();
    });

    it("should not display general error when errors.general is not provided", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
          errors={{}}
        />
      );

      expect(screen.queryByText(/Ein allgemeiner Fehler ist aufgetreten/)).not.toBeInTheDocument();
    });
  });

  describe("Not Rendered When Closed", () => {
    it("should not render when isOpen is false", () => {
      render(
        <EventFormModal
          isOpen={false}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Button Actions", () => {
    it("should not call onSubmit when cancel button is clicked", () => {
      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={defaultEventData}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
      fireEvent.click(cancelButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Form Submission", () => {
    it("should not call onSubmit when form has validation errors - empty date", async () => {
      const setEventData = jest.fn();
      const user = userEvent.setup();

      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={{ ...defaultEventData, date: "" }}
          setEventData={setEventData}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Erstellen" });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("Datum ist erforderlich")).toBeInTheDocument();
    });

    it("should not call onSubmit when form has validation errors - empty location", async () => {
      const setEventData = jest.fn();
      const user = userEvent.setup();

      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={{ ...defaultEventData, location: "" }}
          setEventData={setEventData}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Erstellen" });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("Ort ist erforderlich")).toBeInTheDocument();
    });

    it("should not call onSubmit when form has validation errors - empty description", async () => {
      const setEventData = jest.fn();
      const user = userEvent.setup();

      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={{ ...defaultEventData, description: "" }}
          setEventData={setEventData}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Erstellen" });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("Beschreibung ist erforderlich")).toBeInTheDocument();
    });

    it("should not call onSubmit when form has all required fields empty", async () => {
      const setEventData = jest.fn();
      const user = userEvent.setup();

      render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={{
            date: "",
            timeFrom: "",
            timeTo: "",
            location: "",
            description: "",
            latitude: "",
            longitude: "",
            type: "",
            visible: true,
          }}
          setEventData={setEventData}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Erstellen" });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByText("Datum ist erforderlich")).toBeInTheDocument();
      expect(screen.getByText("Ort ist erforderlich")).toBeInTheDocument();
      expect(screen.getByText("Beschreibung ist erforderlich")).toBeInTheDocument();
    });

    it("should clear validation state when modal is reopened", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={{ ...defaultEventData, date: "" }}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      await user.click(screen.getByRole("button", { name: "Erstellen" }));
      expect(screen.getByText("Datum ist erforderlich")).toBeInTheDocument();

      rerender(
        <EventFormModal
          isOpen={false}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={{ ...defaultEventData, date: "" }}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      rerender(
        <EventFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          eventData={{ ...defaultEventData, date: "" }}
          setEventData={jest.fn()}
          isEditing={false}
          initialEventData={undefined}
        />
      );

      expect(screen.queryByText("Datum ist erforderlich")).not.toBeInTheDocument();
    });
  });
});
