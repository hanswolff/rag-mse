import { eventToFormData } from "@/lib/use-event-management";
import type { Event } from "@/types";

describe("event management helpers", () => {
  it("maps all copyable event fields to form data", () => {
    const event: Event = {
      id: "event-1",
      date: "2026-06-04T00:00:00.000Z",
      timeFrom: "09:30",
      timeTo: "12:15",
      location: "Schießstand Waren",
      description: "<p>Training Langwaffe</p>",
      latitude: 53.5162,
      longitude: 12.6791,
      type: "Training",
      visible: false,
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z",
    };

    expect(eventToFormData(event)).toEqual({
      date: "2026-06-04",
      timeFrom: "09:30",
      timeTo: "12:15",
      location: "Schießstand Waren",
      description: "<p>Training Langwaffe</p>",
      latitude: "53.5162",
      longitude: "12.6791",
      type: "Training",
      visible: false,
    });
  });

  it("normalizes nullable event fields for form data", () => {
    const event: Event = {
      id: "event-2",
      date: "2026-06-05",
      timeFrom: "18:00",
      timeTo: "20:00",
      location: "Vereinsheim",
      description: "<p>Besprechung</p>",
      latitude: null,
      longitude: null,
      type: null,
      visible: true,
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z",
    };

    expect(eventToFormData(event)).toEqual({
      date: "2026-06-05",
      timeFrom: "18:00",
      timeTo: "20:00",
      location: "Vereinsheim",
      description: "<p>Besprechung</p>",
      latitude: "",
      longitude: "",
      type: "",
      visible: true,
    });
  });
});
