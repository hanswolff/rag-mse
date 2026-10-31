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
      userId: "admin",
      userName: "Anna Admin",
      isOwn: true,
      enteredBy: { kind: "self" },
    },
    {
      id: "o1",
      startDate: "2026-11-05",
      endDate: "2026-11-05",
      allDay: false,
      timeFrom: "08:00",
      timeTo: "12:00",
      reason: "Schicht",
      userId: "erika",
      userName: "Erika Beispiel",
      isOwn: false,
      enteredBy: { kind: "self" },
    },
    {
      id: "o2",
      startDate: "2026-11-05",
      endDate: "2026-11-06",
      allDay: true,
      timeFrom: null,
      timeTo: null,
      reason: null,
      userId: "max",
      userName: "Max Muster",
      isOwn: false,
      enteredBy: { kind: "self" },
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

  function respondTo(handlers: Record<string, () => Response | Promise<Response>>, calendar: CalendarData = DATA) {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const handler = handlers[`${init?.method ?? "GET"} ${url}`];
      return handler ? handler() : mockFetchResponse(calendar);
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

    const ownConfirmation = await openDelete();
    expect(within(ownConfirmation).getByText("Möchten Sie diese Abwesenheit wirklich löschen?")).toBeInTheDocument();
    await user.click(within(ownConfirmation).getByRole("button", { name: "Abbrechen" }));
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

  describe("Abwesenheiten anderer Benutzer", () => {
    const OWNERS = {
      users: [
        { id: "u1", name: "Anna Admin" },
        { id: "erika", name: "Erika Beispiel" },
        { id: "max", name: "Max Muster" },
      ],
    };
    const OWNERS_ROUTE = "GET /api/abwesenheiten/benutzer";

    function withEnteredBy(enteredBy: Record<string, CalendarData["abwesenheiten"][number]["enteredBy"]>): CalendarData {
      return {
        ...DATA,
        abwesenheiten: DATA.abwesenheiten.map((absence) => ({ ...absence, enteredBy: enteredBy[absence.id] ?? absence.enteredBy })),
      };
    }

    async function openDayList(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("button", { name: "2 abwesend" }));
      return screen.getByRole("dialog", { name: "Abwesend am 05.11.2026" });
    }

    it("lässt Admins beim Eintragen einen Benutzer wählen, vorbelegt mit sich selbst", async () => {
      loggedIn("ADMIN");
      respondTo({ [OWNERS_ROUTE]: () => mockFetchResponse(OWNERS), "POST /api/abwesenheiten": () => mockFetchResponse(SAVED_ABSENCE) });
      const user = await renderPage();

      await user.click(screen.getByRole("button", { name: "Abwesenheit eintragen" }));
      const dialog = screen.getByRole("dialog", { name: "Abwesenheit eintragen" });
      const owner = within(dialog).getByLabelText("Benutzer");
      expect(owner).toHaveValue("u1");
      await within(dialog).findByRole("option", { name: "Erika Beispiel" });
      expect(within(owner).getAllByRole("option").map((option) => option.textContent)).toEqual([
        "Anna Admin",
        "Erika Beispiel",
        "Max Muster",
      ]);

      await user.selectOptions(owner, "erika");
      await user.type(within(dialog).getByLabelText(/^Von/), "06.11.2026");
      await user.click(within(dialog).getByRole("button", { name: "Eintragen" }));

      expect(await screen.findByText("Abwesenheit wurde eingetragen.")).toBeInTheDocument();
      expect(requestTo("POST", "/api/abwesenheiten")).toMatchObject({ startDate: "2026-11-06", userId: "erika" });
    });

    it("passt den Sichtbarkeitshinweis an, wenn ein Admin einen anderen Benutzer wählt", async () => {
      loggedIn("ADMIN");
      respondTo({ [OWNERS_ROUTE]: () => mockFetchResponse(OWNERS) });
      const user = await renderPage();

      await user.click(screen.getByRole("button", { name: "Abwesenheit eintragen" }));
      const dialog = screen.getByRole("dialog", { name: "Abwesenheit eintragen" });
      const owner = within(dialog).getByLabelText("Benutzer");
      expect(within(dialog).getByText("Sichtbar für Sie sowie Administratoren und Prüfer.")).toBeInTheDocument();

      await within(dialog).findByRole("option", { name: "Erika Beispiel" });
      await user.selectOptions(owner, "erika");
      expect(within(dialog).getByText("Sichtbar für den Benutzer sowie Administratoren und Prüfer.")).toBeInTheDocument();
      expect(within(dialog).queryByText("Sichtbar für Sie sowie Administratoren und Prüfer.")).not.toBeInTheDocument();

      await user.selectOptions(owner, "u1");
      expect(within(dialog).getByText("Sichtbar für Sie sowie Administratoren und Prüfer.")).toBeInTheDocument();
    });

    it("zeigt beim Bearbeiten einer fremden Abwesenheit den Hinweis für den Benutzer", async () => {
      loggedIn("ADMIN");
      respondTo({ [OWNERS_ROUTE]: () => mockFetchResponse(OWNERS) });
      const user = await renderPage();

      const list = await openDayList(user);
      await user.click(within(list).getByRole("button", { name: "Abwesenheit von Erika Beispiel, 05.11.2026, 08:00–12:00 Uhr bearbeiten" }));

      const dialog = screen.getByRole("dialog", { name: "Abwesenheit bearbeiten" });
      expect(within(dialog).getByText("Sichtbar für den Benutzer sowie Administratoren und Prüfer.")).toBeInTheDocument();
      await within(dialog).findByRole("option", { name: "Max Muster" });
    });

    it("zeigt den Feldfehler userId am Auswahlfeld", async () => {
      loggedIn("ADMIN");
      const message = "Benutzer nicht gefunden oder nicht aktiviert";
      respondTo({
        [OWNERS_ROUTE]: () => mockFetchResponse(OWNERS),
        "POST /api/abwesenheiten": () => mockFetchResponse({ error: message, fieldErrors: [{ field: "userId", message }] }, false),
      });
      const user = await renderPage();
      select({ startDate: "2026-11-06", endDate: "2026-11-06", allDay: true, timeFrom: "", timeTo: "" });
      await user.click(within(screen.getByRole("dialog", { name: "Was möchten Sie eintragen?" })).getByRole("button", { name: "Abwesenheit" }));
      const dialog = screen.getByRole("dialog", { name: "Abwesenheit eintragen" });
      await user.click(within(dialog).getByRole("button", { name: "Eintragen" }));

      const owner = within(dialog).getByLabelText("Benutzer");
      await waitFor(() => expect(owner).toHaveAttribute("aria-invalid", "true"));
      expect(owner).toHaveAccessibleDescription(message);
    });

    it.each([["Mitglied", "MEMBER"], ["Prüfer", "AUDITOR"]])("zeigt %s kein Benutzerfeld und sendet keine userId", async (_label, role) => {
      loggedIn(role);
      respondTo({ "POST /api/abwesenheiten": () => mockFetchResponse(SAVED_ABSENCE) });
      const user = await renderPage();

      await user.click(screen.getByRole("button", { name: "Abwesenheit eintragen" }));
      const dialog = screen.getByRole("dialog", { name: "Abwesenheit eintragen" });
      expect(within(dialog).queryByLabelText("Benutzer")).not.toBeInTheDocument();
      await user.type(within(dialog).getByLabelText(/^Von/), "06.11.2026");
      await user.click(within(dialog).getByRole("button", { name: "Eintragen" }));

      expect(await screen.findByText("Abwesenheit wurde eingetragen.")).toBeInTheDocument();
      expect(requestTo("POST", "/api/abwesenheiten")).not.toHaveProperty("userId");
      expect(fetchMock).not.toHaveBeenCalledWith("/api/abwesenheiten/benutzer", expect.anything());
    });

    it("bietet Admins in der Tagesliste Bearbeiten an, vorbelegt mit dem Eigentümer, und hängt um", async () => {
      loggedIn("ADMIN");
      respondTo({ [OWNERS_ROUTE]: () => mockFetchResponse(OWNERS), "PUT /api/abwesenheiten/o1": () => mockFetchResponse({ ...SAVED_ABSENCE, id: "o1" }) });
      const user = await renderPage();

      const list = await openDayList(user);
      await user.click(within(list).getByRole("button", { name: "Abwesenheit von Erika Beispiel, 05.11.2026, 08:00–12:00 Uhr bearbeiten" }));

      const dialog = screen.getByRole("dialog", { name: "Abwesenheit bearbeiten" });
      const owner = within(dialog).getByLabelText("Benutzer");
      expect(owner).toHaveValue("erika");
      expect(within(dialog).getByLabelText("Grund")).toHaveValue("Schicht");
      await within(dialog).findByRole("option", { name: "Max Muster" });
      await user.selectOptions(owner, "max");
      const loadsBefore = calendarLoads();
      await user.click(within(dialog).getByRole("button", { name: "Aktualisieren" }));

      expect(await screen.findByText("Abwesenheit wurde aktualisiert.")).toBeInTheDocument();
      expect(requestTo("PUT", "/api/abwesenheiten/o1")).toMatchObject({ reason: "Schicht", userId: "max" });
      await waitFor(() => expect(calendarLoads()).toBe(loadsBefore + 1));
    });

    it("löscht als Admin eine fremde Abwesenheit erst nach Bestätigung", async () => {
      loggedIn("SITE_ADMINISTRATOR");
      respondTo({ "DELETE /api/abwesenheiten/o2": () => mockFetchResponse({ success: true }) });
      const user = await renderPage();

      await user.click(within(await openDayList(user)).getByRole("button", { name: "Abwesenheit von Max Muster, 05.11.2026 – 06.11.2026 löschen" }));
      await user.click(within(screen.getByRole("dialog", { name: "Abwesenheit löschen" })).getByRole("button", { name: "Abbrechen" }));
      expect(requestTo("DELETE", "/api/abwesenheiten/o2")).toBeUndefined();

      const loadsBefore = calendarLoads();
      await user.click(within(await openDayList(user)).getByRole("button", { name: "Abwesenheit von Max Muster, 05.11.2026 – 06.11.2026 löschen" }));
      const confirmation = screen.getByRole("dialog", { name: "Abwesenheit löschen" });
      expect(within(confirmation).getByText("Möchten Sie die Abwesenheit von Max Muster wirklich löschen?")).toBeInTheDocument();
      await user.click(within(confirmation).getByRole("button", { name: "Löschen" }));

      expect(await screen.findByText("Abwesenheit wurde gelöscht.")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/api/abwesenheiten/o2", expect.objectContaining({ method: "DELETE" }));
      await waitFor(() => expect(calendarLoads()).toBe(loadsBefore + 1));
    });

    it("bietet Prüfern in der Tagesliste weder Bearbeiten noch Löschen an", async () => {
      loggedIn("AUDITOR");
      const user = await renderPage();
      const list = await openDayList(user);
      expect(within(list).getByText("Erika Beispiel")).toBeInTheDocument();
      expect(within(list).queryByRole("button", { name: /bearbeiten|löschen/i })).not.toBeInTheDocument();
    });

    it("zeigt in der Tagesliste, wer eine Abwesenheit eingetragen hat", async () => {
      loggedIn("AUDITOR");
      respondTo({}, withEnteredBy({ o1: { kind: "other", name: "Anna Admin" }, o2: { kind: "removed" } }));
      const user = await renderPage();
      const items = within(await openDayList(user)).getAllByRole("listitem");
      expect(items[0]).toHaveTextContent("Eingetragen von Anna Admin");
      expect(items[1]).toHaveTextContent("Eingetragen von einem Administrator");
    });

    it.each([
      [{ kind: "other", name: "Anna Admin" } as const, "Eingetragen von Anna Admin"],
      [{ kind: "removed" } as const, "Eingetragen von einem Administrator"],
    ])("zeigt in den Details der eigenen Abwesenheit den Hinweis %j", async (enteredBy, text) => {
      loggedIn("MEMBER");
      respondTo({}, withEnteredBy({ own: enteredBy }));
      const user = await renderPage();
      await user.click(screen.getByRole("button", { name: "Abwesend: Urlaub" }));
      expect(within(screen.getByRole("dialog", { name: "Eigene Abwesenheit" })).getByText(text)).toBeInTheDocument();
    });

    it("zeigt bei selbst eingetragenen Abwesenheiten keinen Hinweis", async () => {
      loggedIn("ADMIN");
      const user = await renderPage();
      await user.click(screen.getByRole("button", { name: "Abwesend: Urlaub" }));
      expect(within(screen.getByRole("dialog")).queryByText(/Eingetragen von/)).not.toBeInTheDocument();
      await user.keyboard("{Escape}");
      expect(within(await openDayList(user)).queryByText(/Eingetragen von/)).not.toBeInTheDocument();
    });

    function deferred() {
      let resolve: (response: Response) => void = () => {};
      const promise = new Promise<Response>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    }

    function ownerRequests() {
      return fetchMock.mock.calls.filter(([url]) => url === "/api/abwesenheiten/benutzer").length;
    }

    it("unterscheidet die Aktionen zweier Teilzeit-Abwesenheiten desselben Benutzers am selben Tag", async () => {
      loggedIn("ADMIN");
      const erika = DATA.abwesenheiten[1];
      const calendar = {
        ...DATA,
        abwesenheiten: [
          erika,
          { ...erika, id: "o3", timeFrom: "14:00", timeTo: "16:00", reason: "Arzt" },
        ],
      };
      respondTo({ [OWNERS_ROUTE]: () => mockFetchResponse(OWNERS) }, calendar);
      const user = await renderPage();

      await user.click(screen.getByRole("button", { name: "2 abwesend" }));
      const list = screen.getByRole("dialog", { name: "Abwesend am 05.11.2026" });
      expect(within(list).getByRole("button", { name: "Abwesenheit von Erika Beispiel, 05.11.2026, 08:00–12:00 Uhr löschen" })).toBeInTheDocument();
      await user.click(within(list).getByRole("button", { name: "Abwesenheit von Erika Beispiel, 05.11.2026, 14:00–16:00 Uhr bearbeiten" }));

      expect(within(screen.getByRole("dialog", { name: "Abwesenheit bearbeiten" })).getByLabelText("Grund")).toHaveValue("Arzt");
    });

    it("zeigt die Limit-Meldung mit Namen am Feld „Benutzer“, nicht an „Bis“ oder „Grund“", async () => {
      loggedIn("ADMIN");
      const message =
        "Für Anna Bischof-Grundmann sind bereits 100 laufende oder künftige Abwesenheiten eingetragen. Bitte löschen Sie nicht mehr benötigte Einträge, bevor Sie weitere anlegen.";
      respondTo({
        [OWNERS_ROUTE]: () => mockFetchResponse(OWNERS),
        "PUT /api/abwesenheiten/o1": () => mockFetchResponse({ error: message, fieldErrors: [{ field: "userId", message }] }, false),
      });
      const user = await renderPage();

      await user.click(within(await openDayList(user)).getByRole("button", { name: /Erika Beispiel.*bearbeiten/ }));
      const dialog = screen.getByRole("dialog", { name: "Abwesenheit bearbeiten" });
      await user.click(within(dialog).getByRole("button", { name: "Aktualisieren" }));

      const owner = within(dialog).getByLabelText("Benutzer");
      await waitFor(() => expect(owner).toHaveAttribute("aria-invalid", "true"));
      expect(owner).toHaveAccessibleDescription(message);
      expect(within(dialog).getByLabelText(/^Bis/)).not.toHaveAttribute("aria-invalid", "true");
      expect(within(dialog).getByLabelText("Grund")).not.toHaveAttribute("aria-invalid", "true");
    });

    it("meldet Laden und Fehler der Benutzerliste in einer Live-Region und lädt auf Wunsch erneut", async () => {
      loggedIn("ADMIN");
      const first = deferred();
      let attempt = 0;
      respondTo({
        [OWNERS_ROUTE]: () => {
          attempt += 1;
          return attempt === 1 ? first.promise : mockFetchResponse(OWNERS);
        },
      });
      const user = await renderPage();

      await user.click(screen.getByRole("button", { name: "Abwesenheit eintragen" }));
      const dialog = screen.getByRole("dialog", { name: "Abwesenheit eintragen" });
      const status = within(dialog).getByRole("status");
      expect(status).toHaveTextContent("Benutzer werden geladen…");
      expect(within(dialog).getByLabelText("Benutzer")).not.toHaveAttribute("aria-busy");

      await act(async () => first.resolve(mockFetchResponse({ error: "kaputt" }, false)));
      expect(status).toHaveTextContent("Benutzer konnten nicht geladen werden");
      expect(within(dialog).getByLabelText("Benutzer")).toHaveValue("u1");

      await user.click(within(dialog).getByRole("button", { name: "Erneut laden" }));
      expect(await within(dialog).findByRole("option", { name: "Max Muster" })).toBeInTheDocument();
      expect(status).toHaveTextContent("");
      expect(within(dialog).queryByRole("button", { name: "Erneut laden" })).not.toBeInTheDocument();
      expect(ownerRequests()).toBe(2);
    });

    it("ignoriert eine verspätete Antwort nach dem Schließen", async () => {
      loggedIn("ADMIN");
      const first = deferred();
      const second = deferred();
      let attempt = 0;
      respondTo({
        [OWNERS_ROUTE]: () => {
          attempt += 1;
          return attempt === 1 ? first.promise : second.promise;
        },
      });
      const user = await renderPage();

      await user.click(screen.getByRole("button", { name: "Abwesenheit eintragen" }));
      await user.click(within(screen.getByRole("dialog", { name: "Abwesenheit eintragen" })).getByRole("button", { name: "Abbrechen" }));
      await user.click(screen.getByRole("button", { name: "Abwesenheit eintragen" }));
      await act(async () => first.resolve(mockFetchResponse(OWNERS)));

      const dialog = screen.getByRole("dialog", { name: "Abwesenheit eintragen" });
      expect(within(dialog).getByRole("status")).toHaveTextContent("Benutzer werden geladen…");
      expect(within(within(dialog).getByLabelText("Benutzer")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Anna Admin"]);

      await act(async () => second.resolve(mockFetchResponse(OWNERS)));
      expect(within(dialog).getByRole("option", { name: "Max Muster" })).toBeInTheDocument();
    });

    it("stellt einen in der Liste fehlenden Eigentümer voran", async () => {
      loggedIn("ADMIN");
      respondTo({ [OWNERS_ROUTE]: () => mockFetchResponse({ users: OWNERS.users.filter((owner) => owner.id !== "erika") }) });
      const user = await renderPage();

      await user.click(within(await openDayList(user)).getByRole("button", { name: /Erika Beispiel.*bearbeiten/ }));
      const dialog = screen.getByRole("dialog", { name: "Abwesenheit bearbeiten" });
      const owner = within(dialog).getByLabelText("Benutzer");
      await within(dialog).findByRole("option", { name: "Max Muster" });
      expect(within(owner).getAllByRole("option").map((option) => option.textContent)).toEqual([
        "Erika Beispiel",
        "Anna Admin",
        "Max Muster",
      ]);
      expect(owner).toHaveValue("erika");
    });

    it("belegt nach dem Bearbeiten eines fremden Eintrags beim erneuten Eintragen wieder sich selbst vor", async () => {
      loggedIn("ADMIN");
      respondTo({ [OWNERS_ROUTE]: () => mockFetchResponse(OWNERS) });
      const user = await renderPage();

      await user.click(within(await openDayList(user)).getByRole("button", { name: /Erika Beispiel.*bearbeiten/ }));
      let dialog = screen.getByRole("dialog", { name: "Abwesenheit bearbeiten" });
      expect(within(dialog).getByLabelText("Benutzer")).toHaveValue("erika");
      await user.click(within(dialog).getByRole("button", { name: "Abbrechen" }));

      await user.click(screen.getByRole("button", { name: "Abwesenheit eintragen" }));
      dialog = screen.getByRole("dialog", { name: "Abwesenheit eintragen" });
      await within(dialog).findByRole("option", { name: "Max Muster" });
      expect(within(dialog).getByLabelText("Benutzer")).toHaveValue("u1");
    });
  });
});
