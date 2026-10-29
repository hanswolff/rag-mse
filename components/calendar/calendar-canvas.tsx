"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import deLocale from "@fullcalendar/core/locales/de";
import type {
  DateSelectArg,
  DatesSetArg,
  DayCellContentArg,
  DayHeaderContentArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from "@fullcalendar/core";
import { getSlotRange, type CalendarEntry } from "@/lib/calendar-entries";
import type { CalendarRange } from "@/lib/calendar-service";
import { getLocalDateString } from "@/lib/date-picker-utils";
import {
  CALENDAR_VIEWS,
  parseDateParam,
  resolveInitialView,
  selectionToPeriod,
  toCalendarRange,
  viewParamFor,
  type CalendarSelection,
  type CalendarViewParam,
} from "@/lib/calendar-view-state";
import { CalendarEntryContent } from "./calendar-entry-content";

export interface CalendarNavigation {
  range: CalendarRange;
  view: CalendarViewParam;
  date: string;
}

interface CalendarCanvasProps {
  events: EventInput[];
  onNavigate: (navigation: CalendarNavigation) => void;
  onEntryClick: (entry: CalendarEntry) => void;
  onSelect?: (selection: CalendarSelection) => void;
  collisionDays?: ReadonlySet<string>;
}

const PLUGINS = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin];

const HEADER_TOOLBAR = {
  left: "prev,next today",
  center: "title",
  right: `${CALENDAR_VIEWS.monat},${CALENDAR_VIEWS.woche},${CALENDAR_VIEWS.liste}`,
};

const BUTTON_TEXT = { today: "Heute", month: "Monat", week: "Woche", list: "Liste" };

const SELECT_LONG_PRESS_DELAY_MS = 600;

const EVENT_TIME_FORMAT = { hour: "2-digit", minute: "2-digit", hour12: false } as const;

function renderEventContent(arg: EventContentArg) {
  const entry = arg.event.extendedProps.entry as CalendarEntry;
  const showTime = !arg.view.type.startsWith("list") && !arg.event.allDay;
  return <CalendarEntryContent entry={entry} title={arg.event.title} timeText={showTime ? arg.timeText : undefined} />;
}

type ListDayHeaderContentArg = DayHeaderContentArg & { textId?: string; sideText?: string };

const MONTH_VIEW = CALENDAR_VIEWS.monat;
const COLLISION_DAY_CLASS = "calendar-collision-day";
const NO_COLLISIONS: ReadonlySet<string> = new Set();

function CollisionMarker() {
  return (
    <span className="calendar-collision-marker">
      <span className="sr-only"> (Kollision)</span>
    </span>
  );
}

function isNewTabClick(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function readInitialState() {
  const params = new URLSearchParams(window.location.search);
  return {
    view: CALENDAR_VIEWS[resolveInitialView(params.get("ansicht"), window.innerWidth)],
    date: parseDateParam(params.get("datum")) ?? undefined,
  };
}

export default function CalendarCanvas({
  events,
  onNavigate,
  onEntryClick,
  onSelect,
  collisionDays = NO_COLLISIONS,
}: CalendarCanvasProps) {
  const [{ view: initialView, date: initialDate }] = useState(readInitialState);

  const isMarkedCell = (arg: DayCellContentArg) =>
    arg.view.type === MONTH_VIEW && collisionDays.has(getLocalDateString(arg.date));
  const isMarkedHeader = (arg: DayHeaderContentArg) =>
    arg.view.type !== MONTH_VIEW && collisionDays.has(getLocalDateString(arg.date));

  const dayCellContent = (arg: DayCellContentArg) =>
    isMarkedCell(arg) ? (
      <>
        {arg.dayNumberText}
        <CollisionMarker />
      </>
    ) : (
      true
    );

  const dayHeaderContent = (arg: ListDayHeaderContentArg) => {
    if (!isMarkedHeader(arg)) return true;
    if (arg.view.type.startsWith("list")) {
      return (
        <>
          <a id={arg.textId} className="fc-list-day-text">
            {arg.text}{" "}
            <span className="calendar-collision-label">Kollision</span>
          </a>
          {arg.sideText && (
            <a aria-hidden="true" className="fc-list-day-side-text">
              {arg.sideText}
            </a>
          )}
        </>
      );
    }
    return (
      <>
        {arg.text}
        <CollisionMarker />
      </>
    );
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    onNavigate({
      range: toCalendarRange(arg.start, arg.end),
      view: viewParamFor(arg.view.type),
      date: getLocalDateString(arg.view.currentStart),
    });
  };

  const handleEventClick = ({ jsEvent, event }: EventClickArg) => {
    const entry = event.extendedProps.entry as CalendarEntry;
    if (entry.kind === "termin" && isNewTabClick(jsEvent)) return;
    jsEvent.preventDefault();
    onEntryClick(entry);
  };

  const handleSelect = ({ start, end, allDay, view }: DateSelectArg) => {
    view.calendar.unselect();
    onSelect?.(selectionToPeriod(start, end, allDay));
  };

  return (
    <FullCalendar
      plugins={PLUGINS}
      locale={deLocale}
      firstDay={1}
      initialView={initialView}
      initialDate={initialDate}
      headerToolbar={HEADER_TOOLBAR}
      buttonText={BUTTON_TEXT}
      noEventsText="Keine Einträge in diesem Zeitraum"
      moreLinkText={(count) => `+${count} weitere`}
      moreLinkHint={(count) => `${count} weitere Einträge anzeigen`}
      eventHint="Eintrag"
      height="auto"
      {...getSlotRange(events)}
      dayMaxEvents
      eventDisplay="block"
      eventInteractive
      eventTimeFormat={EVENT_TIME_FORMAT}
      slotLabelFormat={EVENT_TIME_FORMAT}
      nowIndicator
      events={events}
      eventContent={renderEventContent}
      eventClick={handleEventClick}
      selectable={Boolean(onSelect)}
      selectLongPressDelay={SELECT_LONG_PRESS_DELAY_MS}
      select={handleSelect}
      datesSet={handleDatesSet}
      dayCellClassNames={(arg) => (isMarkedCell(arg) ? [COLLISION_DAY_CLASS] : [])}
      dayCellContent={dayCellContent}
      dayHeaderClassNames={(arg) => (isMarkedHeader(arg) ? [COLLISION_DAY_CLASS] : [])}
      dayHeaderContent={dayHeaderContent}
    />
  );
}
