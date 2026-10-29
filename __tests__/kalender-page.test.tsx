import { useEffect } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession } from "next-auth/react";
import type { EventInput } from "@fullcalendar/core";
import KalenderPage from "@/app/kalender/page";
import { ConfirmDialogProvider } from "@/components/confirm-dialog";
import type { CalendarData } from "@/lib/calendar-service";
import type { CalendarEntry } from "@/lib/calendar-entries";
import { CALENDAR_FILTER_STORAGE_KEY, type CalendarSelection } from "@/lib/calendar-view-state";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => "/kalender",
}));

interface MockCanvasProps {
  events: EventInput[];
  onNavigate: (navigation: { range: { from: string; to: string }; view: string; date: string }) => void;
  onEntryClick: (entry: CalendarEntry) => void;
  onSelect?: (selection: CalendarSelection) => void;
  collisionDays?: ReadonlySet<string>;
}

let mockOnSelect: MockCanvasProps["onSelect"];

function MockCalendarCanvas({ events, onNavigate, onEntryClick, onSelect, collisionDays }: MockCanvasProps) {
  useEffect(() => {
    mockOnSelect = onSelect;
  }, [onSelect]);
  useEffect(() => {
    onNavigate({ range: { from: "2026-11-01", to: "2026-11-30" }, view: "monat", date: "2026-11-01" });
  }, [onNavigate]);
  return (
    <div data-testid="calendar" data-collisions={[...(collisionDays ?? [])].join(",")}>
      {events.map((event) => (
        <button key={event.id} type="button" onClick={() => onEntryClick(event.extendedProps?.entry as CalendarEntry)}>
          {event.title}
        </button>
      ))}
    </div>
  );
}

jest.mock("next/dynamic", () => () => MockCalendarCanvas);

const DATA: CalendarData = {
  termine: [
    { id: "t1", date: "2026-11-10", timeFrom: "18:00", timeTo: "20:00", title: "Vereinstraining", type: "Training", location: "Stand" },
  ],
  fremdtermine: [
    {
      id: "f1",
      title: "RDL Schießausbildung",
      startDate: "2026-11-14",
      endDate: "2026-11-15",
      allDay: true,
      timeFrom: null,
      timeTo: null,
      location: "Kaserne",
      description: "Ausbildung am Gewehr",
      url: "https://example.com/rdl",
      kind: "RDL",
      visibility: "MEMBER",
      ausschreibung: { id: "a1", title: "Ausschreibung RDL", fileUrl: "/api/ausschreibungen/a1/file" },
    },
  ],
  abwesenheiten: [
    {
      id: "own",
      startDate: "2026-11-03",
      endDate: "2026-11-04",
      allDay: true,
      timeFrom: null,
      timeTo: null,
      reason: "Urlaub",
      userName: "Anna Admin",
      isOwn: true,
    },
    {
      id: "o1",
      startDate: "2026-11-05",
      endDate: "2026-11-05",
      allDay: false,
      timeFrom: "08:00",
      timeTo: "12:00",
      reason: "Schicht",
      userName: "Erika Beispiel",
      isOwn: false,
    },
    {
      id: "o2",
      startDate: "2026-11-05",
      endDate: "2026-11-06",
      allDay: true,
      timeFrom: null,
      timeTo: null,
      reason: null,
      userName: "Max Muster",
      isOwn: false,
    },
  ],
};

function mockFetchResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

function loggedIn(role = "ADMIN") {
  jest.mocked(useSession).mockReturnValue({
    data: { user: { id: "u1", name: "Anna Admin", email: "anna@example.com", role }, expires: "2099-01-01" },
    status: "authenticated",
    update: jest.fn(),
  } as never);
}

function anonymous() {
  jest.mocked(useSession).mockReturnValue({ data: null, status: "unauthenticated", update: jest.fn() } as never);
}

function PageWithProviders() {
  return (
    <ConfirmDialogProvider>
      <KalenderPage />
    </ConfirmDialogProvider>
  );
}

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/kalender");
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue(mockFetchResponse(DATA));
});

async function renderPage() {
  const user = userEvent.setup();
  render(<PageWithProviders />);
  await screen.findByRole("button", { name: "Vereinstraining" });
  return user;
}

describe("Kalender-Seite", () => {
  describe("Kollisionen", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(mockFetchResponse({ ...DATA, kollisionen: ["2026-11-10", "2026-11-14"] }));
    });

    it.each(["ADMIN", "AUDITOR"])("markiert für %s die Kollisionstage und zeigt die Legende", async (role) => {
      loggedIn(role);
      await renderPage();
      expect(screen.getByTestId("calendar")).toHaveAttribute("data-collisions", "2026-11-10,2026-11-14");
      expect(screen.getByText("Kollision")).toBeInTheDocument();
    });

    it("markiert für Mitglieder nichts und zeigt keine Legende", async () => {
      loggedIn("MEMBER");
      await renderPage();
      expect(screen.getByTestId("calendar")).toHaveAttribute("data-collisions", "");
      expect(screen.queryByText("Kollision")).not.toBeInTheDocument();
    });

    it("zeigt anonymen Besuchern keine Legende", async () => {
      anonymous();
      fetchMock.mockResolvedValue(mockFetchResponse(DATA));
      await renderPage();
      expect(screen.queryByText("Kollision")).not.toBeInTheDocument();
    });
  });

  it("lädt den sichtbaren Zeitraum und schreibt Ansicht und Datum in die URL", async () => {
    loggedIn();
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Kalender" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/kalender?von=2026-11-01&bis=2026-11-30", expect.anything());
    expect(window.location.search).toBe("?ansicht=monat&datum=2026-11-01");
  });

  it("aktualisiert die URL ohne fremden History-State, damit Next.js sie übernimmt", async () => {
    loggedIn();
    const replaceState = jest.spyOn(window.history, "replaceState");
    await renderPage();
    expect(replaceState).toHaveBeenCalledWith(null, "", "/kalender?ansicht=monat&datum=2026-11-01");
    replaceState.mockRestore();
  });

  it("lädt neu, wenn der angemeldete Benutzer wechselt", async () => {
    anonymous();
    const { rerender } = render(<PageWithProviders />);
    await screen.findByRole("button", { name: "Vereinstraining" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    loggedIn();
    rerender(<PageWithProviders />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: "2 abwesend" })).toBeInTheDocument();
  });

  it("führt beim Klick auf einen Termin zur Detailseite", async () => {
    loggedIn();
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "Vereinstraining" }));
    expect(mockPush).toHaveBeenCalledWith("/termine/t1");
  });

  it("öffnet für einen Fremdtermin einen Dialog mit Ausschreibung und externem Link, Escape schließt", async () => {
    loggedIn();
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "RDL Schießausbildung" }));

    const dialog = screen.getByRole("dialog", { name: "RDL Schießausbildung" });
    expect(within(dialog).getByText("14.11.2026 – 15.11.2026")).toBeInTheDocument();
    expect(within(dialog).getByText("Nur für Mitglieder")).toBeInTheDocument();
    expect(within(dialog).getByText("Kaserne")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Ausschreibung: Ausschreibung RDL" })).toHaveAttribute(
      "href",
      "/api/ausschreibungen/a1/file"
    );
    const external = within(dialog).getByRole("link", { name: "Weitere Informationen" });
    expect(external).toHaveAttribute("href", "https://example.com/rdl");
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("zeigt fremde Abwesenheiten gesammelt pro Tag und listet sie im Dialog", async () => {
    loggedIn();
    const user = await renderPage();

    expect(screen.getByRole("button", { name: "Abwesend: Urlaub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2 abwesend" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 abwesend" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2 abwesend" }));
    const dialog = screen.getByRole("dialog", { name: "Abwesend am 05.11.2026" });
    expect(within(dialog).getByText("Erika Beispiel")).toBeInTheDocument();
    expect(within(dialog).getByText("08:00–12:00 Uhr")).toBeInTheDocument();
    expect(within(dialog).getByText("Schicht")).toBeInTheDocument();
    expect(within(dialog).getByText("Max Muster")).toBeInTheDocument();
    expect(within(dialog).getByText(/ganztägig/)).toBeInTheDocument();
  });

  it("öffnet für die eigene Abwesenheit einen Dialog mit Zeitraum und Grund", async () => {
    loggedIn("MEMBER");
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "Abwesend: Urlaub" }));
    const dialog = screen.getByRole("dialog", { name: "Eigene Abwesenheit" });
    expect(within(dialog).getByText("03.11.2026 – 04.11.2026")).toBeInTheDocument();
    expect(within(dialog).getByText("Urlaub")).toBeInTheDocument();
  });

  it("blendet Eintragsarten aus und merkt sich die Auswahl", async () => {
    loggedIn();
    const user = await renderPage();

    await user.click(screen.getByRole("checkbox", { name: "Fremdtermine" }));
    expect(screen.queryByRole("button", { name: "RDL Schießausbildung" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Abwesenheiten" }));
    expect(screen.queryByRole("button", { name: "2 abwesend" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(CALENDAR_FILTER_STORAGE_KEY) ?? "{}")).toEqual({
      termine: true,
      fremdtermine: false,
      abwesenheiten: false,
    });
  });

  it("übernimmt gemerkte Filter beim Laden", async () => {
    loggedIn();
    window.localStorage.setItem(
      CALENDAR_FILTER_STORAGE_KEY,
      JSON.stringify({ termine: true, fremdtermine: false, abwesenheiten: true })
    );
    await renderPage();
    expect(screen.getByRole("checkbox", { name: "Fremdtermine" })).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "RDL Schießausbildung" })).not.toBeInTheDocument();
  });

  it("funktioniert, wenn localStorage Fehler wirft", async () => {
    loggedIn();
    const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const user = await renderPage();
    await user.click(screen.getByRole("checkbox", { name: "Termine" }));
    expect(screen.queryByRole("button", { name: "Vereinstraining" })).not.toBeInTheDocument();
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("zeigt anonymen Besuchern keinen Abwesenheitsfilter", async () => {
    anonymous();
    fetchMock.mockResolvedValue(mockFetchResponse({ ...DATA, abwesenheiten: [] }));
    await renderPage();
    expect(screen.getByRole("checkbox", { name: "Termine" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Abwesenheiten" })).not.toBeInTheDocument();
  });

  it("zeigt einen Fehler und lädt auf Wunsch erneut", async () => {
    anonymous();
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ error: "kaputt" }, false));
    const user = userEvent.setup();
    render(<PageWithProviders />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Der Kalender konnte nicht geladen werden");
    await user.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(await screen.findByRole("button", { name: "Vereinstraining" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("Kalender bearbeiten", () => {
  const SAVED_ABSENCE = {
    id: "new",
    startDate: "2026-11-06",
    endDate: "2026-11-08",
    allDay: true,
    timeFrom: null,
    timeTo: null,
    reason: null,
    createdAt: "",
    updatedAt: "",
  };

  function respondTo(handlers: Record<string, () => Response>) {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const handler = handlers[`${init?.method ?? "GET"} ${url}`];
      return handler ? handler() : mockFetchResponse(DATA);
    });
  }

  function calendarLoads() {
    return fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/kalender")).length;
  }

  function requestTo(method: string, url: string) {
    const call = fetchMock.mock.calls.find(([callUrl, init]) => callUrl === url && init?.method === method);
    return call && JSON.parse(String(call[1].body ?? "null"));
  }

  function select(selection: CalendarSelection) {
    act(() => mockOnSelect?.(selection));
  }

  it.each([
    ["anonym", null, false, false],
    ["Mitglied", "MEMBER", true, false],
    ["Prüfer", "AUDITOR", true, false],
    ["Administrator", "ADMIN", true, true],
    ["Site-Administrator", "SITE_ADMINISTRATOR", true, true],
  ])("zeigt %s die passenden Knöpfe", async (_label, role, absence, fremdtermin) => {
    if (role) loggedIn(role);
    else anonymous();
    await renderPage();
    expect(Boolean(screen.queryByRole("button", { name: "Abwesenheit eintragen" }))).toBe(absence);
    expect(Boolean(screen.queryByRole("button", { name: "Fremdtermin eintragen" }))).toBe(fremdtermin);
    expect(Boolean(mockOnSelect)).toBe(absence);
  });

  it("trägt eine Abwesenheit mit Hinweis zum Grund ein und lädt den Kalender neu", async () => {
    loggedIn("MEMBER");
    respondTo({ "POST /api/abwesenheiten": () => mockFetchResponse(SAVED_ABSENCE) });
    const user = await renderPage();

    await user.click(screen.getByRole("button", { name: "Abwesenheit eintragen" }));
    const dialog = screen.getByRole("dialog", { name: "Abwesenheit eintragen" });
    const reason = within(dialog).getByLabelText("Grund");
    expect(reason).toHaveAccessibleDescription(expect.stringContaining("keine Gesundheits- oder sonstigen sensiblen Angaben"));
    expect(within(dialog).getByText("Sichtbar für Sie sowie Administratoren und Prüfer.")).toBeInTheDocument();
    expect(within(dialog).getByText("0 / 200 Zeichen")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/^Von/), "06.11.2026");
    await user.type(reason, "Urlaub");
    const loadsBefore = calendarLoads();
    await user.click(within(dialog).getByRole("button", { name: "Eintragen" }));

    expect(await screen.findByText("Abwesenheit wurde eingetragen.")).toBeInTheDocument();
    expect(requestTo("POST", "/api/abwesenheiten")).toMatchObject({
      startDate: "2026-11-06",
      endDate: "2026-11-06",
      allDay: true,
      reason: "Urlaub",
    });
    await waitFor(() => expect(calendarLoads()).toBe(loadsBefore + 1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("füllt das Formular aus einer Tagesauswahl und einer Zeitauswahl vor", async () => {
    loggedIn("MEMBER");
    await renderPage();

    select({ startDate: "2026-11-06", endDate: "2026-11-08", allDay: true, timeFrom: "", timeTo: "" });
    let dialog = screen.getByRole("dialog", { name: "Abwesenheit eintragen" });
    expect(within(dialog).getByLabelText(/^Von/)).toHaveValue("06.11.2026");
    expect(within(dialog).getByLabelText(/^Bis/)).toHaveValue("08.11.2026");
    expect(within(dialog).getByLabelText("Ganztägig")).toBeChecked();
    expect(within(dialog).queryByLabelText(/Uhrzeit von/)).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));

    select({ startDate: "2026-11-10", endDate: "2026-11-10", allDay: false, timeFrom: "09:30", timeTo: "11:00" });
    dialog = screen.getByRole("dialog", { name: "Abwesenheit eintragen" });
    expect(within(dialog).getByLabelText("Ganztägig")).not.toBeChecked();
    expect(within(dialog).getByLabelText(/Uhrzeit von/)).toHaveValue("09:30");
    expect(within(dialog).getByLabelText(/Uhrzeit bis/)).toHaveValue("11:00");
  });

  it("zeigt Feldfehler des Servers am Feld", async () => {
    loggedIn("MEMBER");
    respondTo({
      "POST /api/abwesenheiten": () =>
        mockFetchResponse({ error: "Grund darf maximal 200 Zeichen haben", fieldErrors: [{ field: "reason", message: "Grund darf maximal 200 Zeichen haben" }] }, false),
    });
    const user = await renderPage();
    select({ startDate: "2026-11-06", endDate: "2026-11-06", allDay: true, timeFrom: "", timeTo: "" });
    const dialog = screen.getByRole("dialog", { name: "Abwesenheit eintragen" });
    const reason = within(dialog).getByLabelText("Grund");
    await user.type(reason, "Urlaub");
    await user.click(within(dialog).getByRole("button", { name: "Eintragen" }));

    await waitFor(() => expect(reason).toHaveAttribute("aria-invalid", "true"));
    expect(reason).toHaveAccessibleDescription(expect.stringContaining("Grund darf maximal 200 Zeichen haben"));
    expect(within(dialog).getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("bearbeitet die eigene Abwesenheit aus dem Dialog", async () => {
    loggedIn("MEMBER");
    respondTo({ "PUT /api/abwesenheiten/own": () => mockFetchResponse({ ...SAVED_ABSENCE, id: "own" }) });
    const user = await renderPage();

    await user.click(screen.getByRole("button", { name: "Abwesend: Urlaub" }));
    await user.click(within(screen.getByRole("dialog", { name: "Eigene Abwesenheit" })).getByRole("button", { name: "Bearbeiten" }));

    const dialog = screen.getByRole("dialog", { name: "Abwesenheit bearbeiten" });
    expect(within(dialog).getByLabelText(/^Von/)).toHaveValue("03.11.2026");
    expect(within(dialog).getByLabelText("Grund")).toHaveValue("Urlaub");
    await user.clear(within(dialog).getByLabelText("Grund"));
    await user.type(within(dialog).getByLabelText("Grund"), "verhindert");
    const loadsBefore = calendarLoads();
    await user.click(within(dialog).getByRole("button", { name: "Aktualisieren" }));

    expect(await screen.findByText("Abwesenheit wurde aktualisiert.")).toBeInTheDocument();
    expect(requestTo("PUT", "/api/abwesenheiten/own")).toMatchObject({ startDate: "2026-11-03", endDate: "2026-11-04", reason: "verhindert" });
    await waitFor(() => expect(calendarLoads()).toBe(loadsBefore + 1));
  });

  it("löscht die eigene Abwesenheit erst nach Bestätigung", async () => {
    loggedIn("AUDITOR");
    respondTo({ "DELETE /api/abwesenheiten/own": () => mockFetchResponse({ success: true }) });
    const user = await renderPage();

    const openDelete = async () => {
      await user.click(screen.getByRole("button", { name: "Abwesend: Urlaub" }));
      await user.click(within(screen.getByRole("dialog", { name: "Eigene Abwesenheit" })).getByRole("button", { name: "Löschen" }));
      return screen.getByRole("dialog", { name: "Abwesenheit löschen" });
    };

    await user.click(within(await openDelete()).getByRole("button", { name: "Abbrechen" }));
    expect(requestTo("DELETE", "/api/abwesenheiten/own")).toBeUndefined();

    const loadsBefore = calendarLoads();
    await user.click(within(await openDelete()).getByRole("button", { name: "Löschen" }));
    expect(await screen.findByText("Abwesenheit wurde gelöscht.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/abwesenheiten/own", expect.objectContaining({ method: "DELETE" }));
    await waitFor(() => expect(calendarLoads()).toBe(loadsBefore + 1));
  });

  it("meldet einen Fehler beim Löschen", async () => {
    loggedIn("MEMBER");
    respondTo({ "DELETE /api/abwesenheiten/own": () => mockFetchResponse({ error: "Abwesenheit nicht gefunden" }, false) });
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "Abwesend: Urlaub" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Löschen" }));
    await user.click(within(screen.getByRole("dialog", { name: "Abwesenheit löschen" })).getByRole("button", { name: "Löschen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Abwesenheit nicht gefunden");
  });

  it("bietet Admins bei Auswahl Abwesenheit oder Fremdtermin an und legt einen Fremdtermin an", async () => {
    loggedIn("ADMIN");
    respondTo({ "POST /api/admin/fremdtermine": () => mockFetchResponse({ id: "f2" }) });
    const user = await renderPage();

    select({ startDate: "2026-11-20", endDate: "2026-11-21", allDay: true, timeFrom: "", timeTo: "" });
    await user.click(within(screen.getByRole("dialog", { name: "Was möchten Sie eintragen?" })).getByRole("button", { name: "Fremdtermin" }));

    const dialog = screen.getByRole("dialog", { name: "Neuen Fremdtermin erstellen" });
    expect(within(dialog).getByLabelText(/^Von/)).toHaveValue("20.11.2026");
    expect(within(dialog).getByLabelText(/^Bis/)).toHaveValue("21.11.2026");
    await user.type(within(dialog).getByLabelText(/^Titel/), "Landesmeisterschaft");
    await user.click(within(dialog).getByRole("button", { name: "Erstellen" }));

    expect(await screen.findByText("Fremdtermin wurde gespeichert.")).toBeInTheDocument();
    expect(requestTo("POST", "/api/admin/fremdtermine")).toMatchObject({ title: "Landesmeisterschaft", startDate: "2026-11-20", endDate: "2026-11-21" });

    select({ startDate: "2026-11-20", endDate: "2026-11-20", allDay: true, timeFrom: "", timeTo: "" });
    await user.click(within(screen.getByRole("dialog", { name: "Was möchten Sie eintragen?" })).getByRole("button", { name: "Abwesenheit" }));
    expect(screen.getByRole("dialog", { name: "Abwesenheit eintragen" })).toBeInTheDocument();
  });

  it("lädt den vollständigen Fremdtermin zum Bearbeiten und behält eine verborgene Ausschreibung", async () => {
    loggedIn("ADMIN");
    const full = {
      ...DATA.fremdtermine[0],
      ausschreibung: { id: "hidden-a", title: "Verborgene Ausschreibung" },
      ausschreibungId: "hidden-a",
      visibility: "MEMBER",
      createdAt: "",
      updatedAt: "",
    };
    respondTo({
      "GET /api/admin/fremdtermine/f1": () => mockFetchResponse(full),
      "PUT /api/admin/fremdtermine/f1": () => mockFetchResponse(full),
    });
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "RDL Schießausbildung" }));
    await user.click(within(screen.getByRole("dialog", { name: "RDL Schießausbildung" })).getByRole("button", { name: "Bearbeiten" }));

    const dialog = await screen.findByRole("dialog", { name: "Fremdtermin bearbeiten" });
    expect(screen.queryByRole("dialog", { name: "RDL Schießausbildung" })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Titel/)).toHaveValue("RDL Schießausbildung");
    expect(within(dialog).getByLabelText("Ausschreibung")).toHaveDisplayValue("Verborgene Ausschreibung");
    await user.click(within(dialog).getByRole("button", { name: "Aktualisieren" }));

    expect(await screen.findByText("Fremdtermin wurde gespeichert.")).toBeInTheDocument();
    expect(requestTo("PUT", "/api/admin/fremdtermine/f1")).toMatchObject({ ausschreibungId: "hidden-a", visibility: "MEMBER" });
  });

  it("meldet, wenn der Fremdtermin nicht geladen werden kann", async () => {
    loggedIn("ADMIN");
    respondTo({ "GET /api/admin/fremdtermine/f1": () => mockFetchResponse({ error: "Fremdtermin nicht gefunden" }, false) });
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "RDL Schießausbildung" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Bearbeiten" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fremdtermin nicht gefunden");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blendet die Erfolgsmeldung bei der nächsten Aktion aus", async () => {
    loggedIn("MEMBER");
    respondTo({ "POST /api/abwesenheiten": () => mockFetchResponse(SAVED_ABSENCE) });
    const user = await renderPage();
    select({ startDate: "2026-11-06", endDate: "2026-11-06", allDay: true, timeFrom: "", timeTo: "" });
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eintragen" }));
    expect(await screen.findByText("Abwesenheit wurde eingetragen.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abwesenheit eintragen" }));
    expect(screen.queryByText("Abwesenheit wurde eingetragen.")).not.toBeInTheDocument();
  });

  it("bietet Prüfern im Fremdtermin-Dialog kein Bearbeiten an", async () => {
    loggedIn("AUDITOR");
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "RDL Schießausbildung" }));
    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Bearbeiten" })).not.toBeInTheDocument();
  });
});
