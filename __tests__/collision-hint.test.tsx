import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EventFormModal } from "@/components/event-form-modal";
import { formatCollisionHint, formatWeekdayDate } from "@/lib/collision-hint";
import type { CollisionDay } from "@/lib/collision-service";
import { COLLISION_HINT_DEBOUNCE_MS } from "@/lib/use-collision-hint";
import type { NewEvent } from "@/types";

jest.mock("@/components/rich-text-editor", () => ({
  RichTextEditor: ({ labelId, value }: { labelId: string; value: string }) => (
    <textarea aria-labelledby={labelId} value={value} readOnly />
  ),
}));

const DAY: CollisionDay = {
  date: "2026-10-24",
  termine: [{ id: "t2", label: "Training", timeFrom: "18:00", timeTo: "20:00", type: "Training", visibility: "HIDDEN" }],
  fremdtermine: [
    {
      id: "f1",
      title: "Übungsschießen",
      kind: "RDL",
      startDate: "2026-10-23",
      endDate: "2026-10-25",
      allDay: true,
      timeFrom: null,
      timeTo: null,
    },
  ],
  abwesenheiten: { count: 4, names: ["Anna", "Erika", "Max", "Paul"] },
};

const EMPTY_DAY: CollisionDay = { date: "2026-10-24", termine: [], fremdtermine: [], abwesenheiten: { count: 0, names: [] } };

const EXPECTED_HINT =
  "Am Sa., 24.10.2026 außerdem: RDL „Übungsschießen“ (Fremdtermin), Training 18:00 Uhr (Termin), 4 Abwesenheiten (Anna, Erika, Max, Paul)";

const EVENT: NewEvent = {
  date: "2026-10-24",
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

describe("formatCollisionHint", () => {
  it("fasst Fremdtermine, Termine und Abwesenheiten in einem Satz zusammen", () => {
    expect(formatCollisionHint(DAY)).toBe(EXPECTED_HINT);
  });

  it("nennt eine einzelne Abwesenheit im Singular und Fremdtermine ohne Art nur mit Titel", () => {
    expect(
      formatCollisionHint({
        ...EMPTY_DAY,
        fremdtermine: [{ ...DAY.fremdtermine[0], kind: null }],
        abwesenheiten: { count: 1, names: [] },
      })
    ).toBe("Am Sa., 24.10.2026 außerdem: „Übungsschießen“ (Fremdtermin), 1 Abwesenheit");
  });

  it("liefert ohne Einträge keinen Hinweis", () => {
    expect(formatCollisionHint(EMPTY_DAY)).toBeNull();
  });

  it("formatiert Wochentag und Datum zeitzonenfest, auch am Tag der Zeitumstellung", () => {
    expect(formatWeekdayDate("2026-10-25")).toBe("So., 25.10.2026");
  });
});

describe("EventFormModal: Kollisionshinweis", () => {
  const fetchMock = jest.fn();
  const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());

  function respond(body: unknown, ok = true) {
    return Promise.resolve({ ok, status: ok ? 200 : 500, json: async () => body } as Response);
  }

  function modal(overrides: Partial<React.ComponentProps<typeof EventFormModal>> = {}) {
    return (
      <EventFormModal
        isOpen
        onClose={jest.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
        eventData={EVENT}
        setEventData={jest.fn()}
        isEditing={false}
        {...overrides}
      />
    );
  }

  async function flushDebounce() {
    await act(async () => {
      jest.advanceTimersByTime(COLLISION_HINT_DEBOUNCE_MS);
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
    onSubmit.mockClear();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("lädt nach der Entprellung die Kollisionen des gewählten Tages und zeigt sie als Warnung", async () => {
    fetchMock.mockImplementation(() => respond(DAY));
    render(modal());

    expect(fetchMock).not.toHaveBeenCalled();
    await flushDebounce();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/kollisionen?datum=2026-10-24");
    expect(await screen.findByText(EXPECTED_HINT)).toHaveAttribute("role", "status");
  });

  it("hält vor dem Hinweis eine leere Live-Region bereit, damit er angesagt wird", async () => {
    fetchMock.mockImplementation(() => respond(DAY));
    render(modal());

    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    expect(region).toHaveAttribute("aria-live", "polite");
    await flushDebounce();

    expect(await screen.findByText(EXPECTED_HINT)).toBe(screen.getByRole("status"));
  });

  it("setzt den Hinweis beim Schließen zurück und zeigt beim Wiederöffnen keinen alten Stand", async () => {
    fetchMock.mockImplementation(() => respond(DAY));
    const { rerender } = render(modal());
    await flushDebounce();
    await screen.findByText(EXPECTED_HINT);

    rerender(modal({ isOpen: false }));
    rerender(modal());
    expect(screen.queryByText(EXPECTED_HINT)).not.toBeInTheDocument();

    fetchMock.mockImplementation(() => respond(EMPTY_DAY));
    await flushDebounce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(EXPECTED_HINT)).not.toBeInTheDocument();
  });

  it("nimmt beim Bearbeiten den eigenen Termin aus", async () => {
    fetchMock.mockImplementation(() => respond(EMPTY_DAY));
    render(modal({ isEditing: true, eventId: "t1", initialEventData: EVENT }));
    await flushDebounce();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/kollisionen?datum=2026-10-24&ohneTermin=t1");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("fragt bei schnellem Datumswechsel nur das zuletzt gewählte Datum ab", async () => {
    fetchMock.mockImplementation(() => respond({ ...DAY, date: "2026-10-25" }));
    const { rerender } = render(modal());
    rerender(modal({ eventData: { ...EVENT, date: "2026-10-25" } }));
    await flushDebounce();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/kollisionen?datum=2026-10-25");
    expect(await screen.findByText(/^Am So\., 25\.10\.2026 außerdem/)).toBeInTheDocument();
  });

  it("verwirft eine veraltete Antwort, wenn sich das Datum inzwischen geändert hat", async () => {
    let resolveFirst: (response: Response) => void = () => undefined;
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementation(() => respond(EMPTY_DAY));
    const { rerender } = render(modal());
    await flushDebounce();

    rerender(modal({ eventData: { ...EVENT, date: "2026-10-26" } }));
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => resolveFirst({ ok: true, status: 200, json: async () => DAY } as Response));

    expect(screen.queryByText(EXPECTED_HINT)).not.toBeInTheDocument();
  });

  it("fragt ohne gültiges Datum und bei geschlossenem Formular nichts ab", async () => {
    const { rerender } = render(modal({ eventData: { ...EVENT, date: "" } }));
    await flushDebounce();
    rerender(modal({ isOpen: false }));
    await flushDebounce();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bleibt bei einem Fehler still und blockiert das Speichern nicht", async () => {
    fetchMock.mockImplementation(() => respond({ error: "Keine Admin-Berechtigung" }, false));
    render(modal());
    await flushDebounce();

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByText("Keine Admin-Berechtigung")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Erstellen" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("blockiert das Speichern auch bei angezeigtem Hinweis nicht", async () => {
    fetchMock.mockImplementation(() => respond(DAY));
    render(modal());
    await flushDebounce();
    await screen.findByText(EXPECTED_HINT);

    fireEvent.click(screen.getByRole("button", { name: "Erstellen" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
