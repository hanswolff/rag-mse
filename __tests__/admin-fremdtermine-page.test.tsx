import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import FremdterminePage from "../app/admin/fremdtermine/page";
import { ExternalEventFormModal } from "@/components/external-event-form-modal";
import { useExternalEventManagement } from "@/lib/use-external-event-management";
import { EMPTY_EXTERNAL_EVENT_FORM } from "@/types";
import type { ExternalEventForm, ExternalEventItem } from "@/types";
import { useSession } from "next-auth/react";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("@/lib/use-external-event-management", () => ({
  ...jest.requireActual("@/lib/use-external-event-management"),
  useExternalEventManagement: jest.fn(),
}));

function item(overrides: Partial<ExternalEventItem>): ExternalEventItem {
  return {
    id: "id",
    title: "Fremdtermin",
    startDate: "2026-11-06",
    endDate: "2026-11-06",
    allDay: true,
    timeFrom: null,
    timeTo: null,
    location: null,
    description: null,
    url: null,
    kind: null,
    visibility: "MEMBER",
    ausschreibungId: null,
    ausschreibung: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

const externalEvents = [
  item({ id: "past", title: "Herbstpokal 2025", startDate: "2025-10-01", endDate: "2025-10-01", kind: "COMPETITION" }),
  item({
    id: "next",
    title: "RDL Schießausbildung",
    startDate: "2099-11-06",
    endDate: "2099-11-08",
    kind: "RDL",
    visibility: "PUBLIC",
    url: "https://example.org/rdl",
    ausschreibung: { id: "a1", title: "Ausschreibung RDL" },
  }),
];

function mockManagement(overrides: Partial<ReturnType<typeof useExternalEventManagement>> = {}) {
  const form = {
    isOpen: false,
    editingExternalEvent: null,
    data: EMPTY_EXTERNAL_EVENT_FORM,
    setData: jest.fn(),
    initialData: undefined,
    isSubmitting: false,
    error: "",
    fieldErrors: [],
    openCreate: jest.fn(),
    openEdit: jest.fn(),
    close: jest.fn(),
    handleSubmit: jest.fn(),
  };
  const management = {
    externalEvents,
    isLoading: false,
    isDeleting: false,
    error: "",
    success: "",
    handleDelete: jest.fn(),
    form,
    ...overrides,
  };
  jest.mocked(useExternalEventManagement).mockReturnValue(management);
  return management;
}

function loginWithRole(role: string) {
  jest.mocked(useSession).mockReturnValue({
    data: { user: { id: "u1", role }, expires: "" },
    status: "authenticated",
    update: jest.fn(),
  } as ReturnType<typeof useSession>);
}

describe("Admin-Seite Fremdtermine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ausschreibungen: [] }) });
  });

  it("zeigt kommende Fremdtermine vor den vergangenen mit Art, Sichtbarkeitsstufe und Ausschreibung", () => {
    loginWithRole("ADMIN");
    mockManagement();
    render(<FremdterminePage />);

    const upcoming = screen.getByRole("region", { name: "Kommende Fremdtermine" });
    const past = screen.getByRole("region", { name: "Vergangene Fremdtermine" });
    expect(upcoming.compareDocumentPosition(past) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(within(upcoming).getByText("RDL Schießausbildung")).toBeInTheDocument();
    expect(within(upcoming).getByText("06.11.2099 – 08.11.2099")).toBeInTheDocument();
    expect(within(upcoming).queryByText("Öffentlich")).not.toBeInTheDocument();
    expect(within(past).getByText("Nur für Mitglieder")).toBeInTheDocument();
    expect(within(upcoming).getByRole("link", { name: "Weitere Informationen" })).toHaveAttribute("href", "https://example.org/rdl");
    expect(within(upcoming).getByRole("link", { name: "Ausschreibung: Ausschreibung RDL" })).toBeInTheDocument();
    expect(within(past).getByText("Herbstpokal 2025")).toBeInTheDocument();
    expect(within(past).getByText("Wettkampf")).toBeInTheDocument();
  });

  it("Administrator kann anlegen, bearbeiten und löschen", async () => {
    loginWithRole("ADMIN");
    const management = mockManagement();
    render(<FremdterminePage />);

    await userEvent.click(screen.getByRole("button", { name: "+ Neuer Fremdtermin" }));
    expect(management.form.openCreate).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Fremdtermin bearbeiten: RDL Schießausbildung" }));
    expect(management.form.openEdit).toHaveBeenCalledWith(externalEvents[1]);

    await userEvent.click(screen.getByRole("button", { name: "Fremdtermin löschen: Herbstpokal 2025" }));
    expect(management.handleDelete).toHaveBeenCalledWith("past");
  });

  it("Prüfer sieht die Liste ohne Schreibknöpfe", () => {
    loginWithRole("AUDITOR");
    mockManagement();
    render(<FremdterminePage />);

    expect(screen.getByText("RDL Schießausbildung")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Neuer Fremdtermin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fremdtermin (bearbeiten|löschen)/ })).not.toBeInTheDocument();
  });

  it("zeigt einen Hinweis, wenn keine Fremdtermine vorhanden sind", () => {
    loginWithRole("AUDITOR");
    mockManagement({ externalEvents: [] });
    render(<FremdterminePage />);

    expect(screen.getByText("Keine Fremdtermine vorhanden.")).toBeInTheDocument();
  });
});

describe("Formular Fremdtermin", () => {
  const onSubmit = jest.fn((e: React.FormEvent) => e.preventDefault());

  function StatefulModal({
    initial,
    currentAusschreibung = null,
  }: {
    initial: ExternalEventForm;
    currentAusschreibung?: { id: string; title: string } | null;
  }) {
    const [data, setData] = useState(initial);
    return (
      <ExternalEventFormModal
        isOpen
        onClose={jest.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
        data={data}
        setData={setData}
        isEditing={false}
        currentAusschreibung={currentAusschreibung}
      />
    );
  }

  const filled: ExternalEventForm = {
    ...EMPTY_EXTERNAL_EVENT_FORM,
    title: "RK-Pokal",
    startDate: "2026-11-06",
    endDate: "2026-11-06",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ausschreibungen: [
          { id: "a1", title: "Ausschreibung 2099", expiresAt: "2099-01-01T00:00:00.000Z" },
          { id: "a2", title: "Ausschreibung 2020", expiresAt: "2020-01-01T00:00:00.000Z" },
        ],
      }),
    });
  });

  it("bietet aktuelle und abgelaufene Ausschreibungen, Arten und Sichtbarkeitsstufen an", async () => {
    render(<StatefulModal initial={filled} />);

    const ausschreibung = screen.getByLabelText("Ausschreibung");
    await waitFor(() => expect(within(ausschreibung).getAllByRole("option")).toHaveLength(3));
    expect(within(ausschreibung).getByRole("option", { name: "Ausschreibung 2020 (abgelaufen)" })).toBeInTheDocument();

    const kinds = within(screen.getByLabelText("Art")).getAllByRole("option").map((option) => option.textContent);
    expect(kinds).toEqual(["Keine Art", "RDL", "RK-Veranstaltung", "Wettkampf", "Sonstiges"]);
    expect(screen.getByLabelText("Sichtbarkeitsstufe")).toHaveValue("MEMBER");
  });

  it("sperrt die Ausschreibungsauswahl während des Ladens", async () => {
    let resolve: (value: unknown) => void = () => {};
    global.fetch = jest.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    render(<StatefulModal initial={filled} />);

    expect(screen.getByLabelText("Ausschreibung")).toBeDisabled();
    expect(screen.getByText("Ausschreibungen werden geladen…")).toBeInTheDocument();

    resolve({ ok: true, json: async () => ({ ausschreibungen: [] }) });
    await waitFor(() => expect(screen.getByLabelText("Ausschreibung")).toBeEnabled());
  });

  it("meldet einen Ladefehler und behält die verknüpfte Ausschreibung als Option", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    render(
      <StatefulModal
        initial={{ ...filled, ausschreibungId: "alt" }}
        currentAusschreibung={{ id: "alt", title: "Gelöschte Liste" }}
      />
    );

    expect(await screen.findByText(/Ausschreibungen konnten nicht geladen werden/)).toBeInTheDocument();
    expect(screen.getByLabelText("Ausschreibung")).toHaveDisplayValue("Gelöschte Liste");
  });

  it("zeigt Uhrzeiten erst ohne Ganztag und verlangt sie dann", async () => {
    render(<StatefulModal initial={filled} />);

    expect(screen.queryByLabelText(/Uhrzeit von/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Ganztägig"));
    expect(screen.getByLabelText(/Uhrzeit von/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Erstellen" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Uhrzeit von ist erforderlich, wenn nicht ganztägig")).toBeInTheDocument();
  });

  it("meldet ein Bis vor dem Von", async () => {
    render(<StatefulModal initial={{ ...filled, endDate: "2026-11-01" }} />);

    expect(screen.getByText("„Bis“ darf nicht vor „Von“ liegen")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Erstellen" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sendet einen gültigen ganztägigen Fremdtermin ab", async () => {
    render(<StatefulModal initial={filled} />);

    await userEvent.click(screen.getByRole("button", { name: "Erstellen" }));
    expect(onSubmit).toHaveBeenCalled();
  });
});
