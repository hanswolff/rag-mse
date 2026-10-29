import { act, renderHook } from "@testing-library/react";
import { absenceToForm, useAbsenceForm } from "@/lib/use-absence-form";
import type { AbsenceItem } from "@/types";

const saved: AbsenceItem = {
  id: "a1",
  startDate: "2026-11-06",
  endDate: "2026-11-08",
  allDay: false,
  timeFrom: "08:00",
  timeTo: "12:00",
  reason: null,
  createdAt: "",
  updatedAt: "",
};

const submitEvent = { preventDefault: jest.fn() } as unknown as React.FormEvent;

function respond(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
}

describe("useAbsenceForm", () => {
  it("überführt eine Abwesenheit in Formularwerte", () => {
    expect(absenceToForm({ ...saved, allDay: true, timeFrom: null, timeTo: null, reason: "Urlaub" })).toEqual({
      startDate: "2026-11-06",
      endDate: "2026-11-08",
      allDay: true,
      timeFrom: "",
      timeTo: "",
      reason: "Urlaub",
    });
  });

  it("legt per POST an und meldet das Ergebnis", async () => {
    respond(201, saved);
    const onSaved = jest.fn();
    const { result } = renderHook(() => useAbsenceForm(onSaved));

    act(() => result.current.openCreate({ startDate: "2026-11-06", endDate: "2026-11-08" }));
    await act(() => result.current.handleSubmit(submitEvent));

    const [url, init] = jest.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("/api/abwesenheiten");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      startDate: "2026-11-06",
      endDate: "2026-11-08",
      allDay: true,
      timeFrom: "",
      timeTo: "",
      reason: "",
    });
    expect(onSaved).toHaveBeenCalledWith(saved, "created");
    expect(result.current.isOpen).toBe(false);
  });

  it("ändert per PUT und behält bei Fehlern die Feldfehler", async () => {
    const fieldErrors = [{ field: "reason", message: "Grund darf maximal 200 Zeichen haben" }];
    respond(400, { error: "Grund darf maximal 200 Zeichen haben", fieldErrors });
    const { result } = renderHook(() => useAbsenceForm(jest.fn()));

    act(() => result.current.openEdit(saved));
    expect(result.current.editingAbsence).toBe(saved);
    expect(result.current.initialData).toEqual(absenceToForm(saved));
    await act(() => result.current.handleSubmit(submitEvent));

    const [url, init] = jest.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("/api/abwesenheiten/a1");
    expect(init?.method).toBe("PUT");
    expect(result.current.isOpen).toBe(true);
    expect(result.current.fieldErrors).toEqual(fieldErrors);
  });
});
