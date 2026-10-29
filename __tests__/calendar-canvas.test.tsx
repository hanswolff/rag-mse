import { act, render, screen } from "@testing-library/react";
import type { CalendarOptions } from "@fullcalendar/core";
import CalendarCanvas from "@/components/calendar/calendar-canvas";
import { CalendarEntryContent } from "@/components/calendar/calendar-entry-content";
import type { CalendarEntry } from "@/lib/calendar-entries";

let mockProps: CalendarOptions;

jest.mock("@fullcalendar/react", () => ({
  __esModule: true,
  default: (props: CalendarOptions) => {
    mockProps = props;
    return <div data-testid="fullcalendar" />;
  },
}));
jest.mock("@fullcalendar/daygrid", () => ({ __esModule: true, default: {} }));
jest.mock("@fullcalendar/timegrid", () => ({ __esModule: true, default: {} }));
jest.mock("@fullcalendar/list", () => ({ __esModule: true, default: {} }));
jest.mock("@fullcalendar/interaction", () => ({ __esModule: true, default: {} }));
jest.mock("@fullcalendar/core/locales/de", () => ({ __esModule: true, default: { code: "de" } }));

const FREMDTERMIN: CalendarEntry = {
  kind: "fremdtermin",
  fremdtermin: {
    id: "f1",
    title: "RDL",
    startDate: "2026-11-14",
    endDate: "2026-11-14",
    allDay: false,
    timeFrom: "08:00",
    timeTo: "16:00",
    location: null,
    description: null,
    url: null,
    kind: "RK_EVENT",
    visibility: "HIDDEN",
    ausschreibung: null,
  },
};

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

function renderCanvas(search = "", onSelect?: jest.Mock, collisionDays?: ReadonlySet<string>) {
  window.history.replaceState(null, "", `/kalender${search}`);
  const onNavigate = jest.fn();
  const onEntryClick = jest.fn();
  render(
    <CalendarCanvas
      events={[]}
      onNavigate={onNavigate}
      onEntryClick={onEntryClick}
      onSelect={onSelect}
      collisionDays={collisionDays}
    />
  );
  return { onNavigate, onEntryClick };
}

describe("CalendarCanvas", () => {
  afterEach(() => setViewport(1024));

  it("startet ohne Parameter auf dem Desktop im Monat mit deutschem Wochenstart Montag", () => {
    setViewport(1280);
    renderCanvas();
    expect(mockProps).toMatchObject({ initialView: "dayGridMonth", firstDay: 1, locale: { code: "de" } });
    expect(mockProps.initialDate).toBeUndefined();
    expect(mockProps.buttonText).toMatchObject({ today: "Heute", list: "Liste" });
  });

  it("startet unter 768 px ohne Parameter in der Liste", () => {
    setViewport(500);
    renderCanvas();
    expect(mockProps.initialView).toBe("listMonth");
  });

  it("übernimmt Ansicht und Datum aus der URL und ignoriert ungültige Werte", () => {
    setViewport(500);
    renderCanvas("?ansicht=woche&datum=2026-11-11");
    expect(mockProps).toMatchObject({ initialView: "timeGridWeek", initialDate: "2026-11-11" });

    renderCanvas("?ansicht=jahr&datum=2026-13-01");
    expect(mockProps.initialView).toBe("listMonth");
    expect(mockProps.initialDate).toBeUndefined();
  });

  it("meldet Zeitraum, Ansicht und Datum bei Navigation", () => {
    const { onNavigate } = renderCanvas();
    const datesSet = mockProps.datesSet as (arg: unknown) => void;
    act(() =>
      datesSet({
        start: new Date(2026, 10, 9),
        end: new Date(2026, 10, 16),
        view: { type: "timeGridWeek", currentStart: new Date(2026, 10, 9) },
      })
    );
    expect(onNavigate).toHaveBeenCalledWith({
      range: { from: "2026-11-09", to: "2026-11-15" },
      view: "woche",
      date: "2026-11-09",
    });
  });

  it("reicht Klicks mit dem Eintrag weiter und verhindert die Standardnavigation", () => {
    const { onEntryClick } = renderCanvas();
    const preventDefault = jest.fn();
    const eventClick = mockProps.eventClick as (arg: unknown) => void;
    eventClick({ jsEvent: { preventDefault }, event: { extendedProps: { entry: FREMDTERMIN } } });
    expect(preventDefault).toHaveBeenCalled();
    expect(onEntryClick).toHaveBeenCalledWith(FREMDTERMIN);
  });

  it("lässt Termin-Links bei Modifikatortasten dem Browser (neuer Tab)", () => {
    const { onEntryClick } = renderCanvas();
    const eventClick = mockProps.eventClick as (arg: unknown) => void;
    const termin: CalendarEntry = {
      kind: "termin",
      termin: { id: "t1", date: "2026-11-10", timeFrom: "18:00", timeTo: "20:00", title: null, type: null, location: "" },
    };
    const click = (overrides: Partial<MouseEvent>) => {
      const preventDefault = jest.fn();
      eventClick({ jsEvent: { button: 0, preventDefault, ...overrides }, event: { extendedProps: { entry: termin } } });
      return preventDefault;
    };

    expect(click({ ctrlKey: true })).not.toHaveBeenCalled();
    expect(click({ metaKey: true })).not.toHaveBeenCalled();
    expect(click({ button: 1 })).not.toHaveBeenCalled();
    expect(onEntryClick).not.toHaveBeenCalled();

    expect(click({})).toHaveBeenCalled();
    expect(onEntryClick).toHaveBeenCalledWith(termin);
  });

  it("zeigt im Eintrag Zeit, Art und Sichtbarkeitskennzeichen", () => {
    renderCanvas();
    const eventContent = mockProps.eventContent as (arg: unknown) => React.ReactElement;
    const arg = (viewType: string) => ({
      event: { title: "RDL", allDay: false, extendedProps: { entry: FREMDTERMIN } },
      view: { type: viewType },
      timeText: "08:00",
    });

    const { unmount } = render(eventContent(arg("dayGridMonth")));
    expect(screen.getByText("08:00")).toBeInTheDocument();
    expect(screen.getByText("Fremdtermin:", { exact: false })).toHaveClass("sr-only");
    expect(screen.getByText("RK-Veranstaltung")).toBeInTheDocument();
    expect(screen.getByText("Verborgen")).toBeInTheDocument();
    unmount();

    render(eventContent(arg("listMonth")));
    expect(screen.queryByText("08:00")).not.toBeInTheDocument();
  });

  it("zeigt bei Terminen die Terminart und „Nur für Mitglieder“, bei Abwesenheiten keine Kennzeichen", () => {
    const termin: CalendarEntry = {
      kind: "termin",
      termin: { id: "t1", date: "2026-11-10", timeFrom: "18:00", timeTo: "20:00", title: "Abend", type: "Lehrgang", location: "", visibility: "MEMBER" },
    };
    const { unmount } = render(<CalendarEntryContent entry={termin} title="Abend" />);
    expect(screen.getByText("Lehrgang")).toBeInTheDocument();
    expect(screen.getByText("Nur für Mitglieder")).toBeInTheDocument();
    unmount();

    const publicTermin: CalendarEntry = { kind: "termin", termin: { ...termin.termin, type: null, visibility: "PUBLIC" } };
    const { container, unmount: unmountPublic } = render(<CalendarEntryContent entry={publicTermin} title="Abend" />);
    expect(container.querySelectorAll(".calendar-tag")).toHaveLength(0);
    unmountPublic();

    render(<CalendarEntryContent entry={{ kind: "abwesenheiten", date: "2026-11-03", absences: [] }} title="0 abwesend" />);
    expect(screen.getByText("0 abwesend")).toBeInTheDocument();
  });

  it("erlaubt die Auswahl nur mit onSelect und meldet sie mit inklusivem Ende", () => {
    renderCanvas();
    expect(mockProps.selectable).toBe(false);

    const onSelect = jest.fn();
    renderCanvas("", onSelect);
    expect(mockProps.selectable).toBe(true);
    expect(mockProps.selectLongPressDelay).toBeGreaterThan(0);

    const unselect = jest.fn();
    const select = mockProps.select as (arg: unknown) => void;
    select({ start: new Date(2026, 10, 6), end: new Date(2026, 10, 9), allDay: true, view: { calendar: { unselect } } });
    expect(unselect).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith({ startDate: "2026-11-06", endDate: "2026-11-08", allDay: true, timeFrom: "", timeTo: "" });

    select({ start: new Date(2026, 10, 10, 9, 30), end: new Date(2026, 10, 10, 11, 0), allDay: false, view: { calendar: { unselect } } });
    expect(onSelect).toHaveBeenLastCalledWith({ startDate: "2026-11-10", endDate: "2026-11-10", allDay: false, timeFrom: "09:30", timeTo: "11:00" });
  });

  describe("Kollisionsmarkierung", () => {
    const COLLISIONS = new Set(["2026-10-24"]);
    type Hook = (arg: unknown) => unknown;
    const hooks = () => ({
      cellClass: mockProps.dayCellClassNames as Hook,
      cellContent: mockProps.dayCellContent as Hook,
      headerClass: mockProps.dayHeaderClassNames as Hook,
      headerContent: mockProps.dayHeaderContent as Hook,
    });
    const day = (viewType: string, date: Date) => ({
      date,
      view: { type: viewType },
      dayNumberText: String(date.getDate()),
      text: "Sa. 24.10.",
    });
    const SATURDAY = new Date(2026, 9, 24);
    const SUNDAY = new Date(2026, 9, 25);

    it("markiert im Monat die Tageszelle mit Klasse und zugänglichem Text „Kollision“", () => {
      renderCanvas("", undefined, COLLISIONS);
      const { cellClass, cellContent, headerClass, headerContent } = hooks();

      expect(cellClass(day("dayGridMonth", SATURDAY))).toEqual(["calendar-collision-day"]);
      expect(cellClass(day("dayGridMonth", SUNDAY))).toEqual([]);
      expect(cellContent(day("dayGridMonth", SUNDAY))).toBe(true);
      render(<>{cellContent(day("dayGridMonth", SATURDAY)) as React.ReactNode}</>);
      expect(screen.getByText("24")).toBeInTheDocument();
      expect(screen.getByText("(Kollision)")).toHaveClass("sr-only");
      expect(screen.getByText("(Kollision)").parentElement).not.toHaveAttribute("title");

      expect(headerClass(day("dayGridMonth", SATURDAY))).toEqual([]);
      expect(headerContent(day("dayGridMonth", SATURDAY))).toBe(true);
    });

    it("markiert in Woche und Liste den Tageskopf, nicht die Zeitspalten; die Liste zeigt „Kollision“ sichtbar am Tagestext", () => {
      renderCanvas("", undefined, COLLISIONS);
      const { cellClass, cellContent, headerClass, headerContent } = hooks();

      expect(cellClass(day("timeGridWeek", SATURDAY))).toEqual([]);
      expect(cellContent(day("timeGridWeek", SATURDAY))).toBe(true);
      expect(headerClass(day("timeGridWeek", SATURDAY))).toEqual(["calendar-collision-day"]);
      expect(headerContent(day("timeGridWeek", SUNDAY))).toBe(true);

      const { unmount } = render(<>{headerContent(day("timeGridWeek", SATURDAY)) as React.ReactNode}</>);
      expect(screen.getByText("Sa. 24.10.")).toBeInTheDocument();
      expect(screen.getByText("(Kollision)")).toBeInTheDocument();
      unmount();

      expect(headerClass(day("listMonth", SATURDAY))).toEqual(["calendar-collision-day"]);
      expect(headerContent(day("listMonth", SUNDAY))).toBe(true);
      render(
        <table>
          <tbody>
            <tr>
              <th aria-labelledby="list-day-text">
                {headerContent({ ...day("listMonth", SATURDAY), textId: "list-day-text", sideText: "Samstag" }) as React.ReactNode}
              </th>
            </tr>
          </tbody>
        </table>
      );
      expect(screen.getByRole("columnheader", { name: "Sa. 24.10. Kollision" })).toBeInTheDocument();
      expect(screen.getByText("Kollision")).toHaveClass("calendar-collision-label");
      expect(screen.getByText("Samstag")).toHaveAttribute("aria-hidden", "true");
    });

    it("markiert ohne Kollisionstage nichts", () => {
      renderCanvas();
      const { cellClass, cellContent, headerClass, headerContent } = hooks();
      expect(cellClass(day("dayGridMonth", SATURDAY))).toEqual([]);
      expect(cellContent(day("dayGridMonth", SATURDAY))).toBe(true);
      expect(headerClass(day("listMonth", SATURDAY))).toEqual([]);
      expect(headerContent(day("listMonth", SATURDAY))).toBe(true);
    });
  });
});
