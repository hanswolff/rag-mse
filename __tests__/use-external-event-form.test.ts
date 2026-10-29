import { act, renderHook } from "@testing-library/react";
import { useExternalEventForm } from "@/lib/use-external-event-form";
import type { ExternalEventItem } from "@/types";

const saved: ExternalEventItem = {
  id: "e1",
  title: "RDL",
  startDate: "2026-11-06",
  endDate: "2026-11-06",
  allDay: true,
  timeFrom: null,
  timeTo: null,
  location: null,
  description: null,
  url: null,
  kind: "RDL",
  visibility: "MEMBER",
  ausschreibungId: null,
  ausschreibung: null,
  createdAt: "",
  updatedAt: "",
};

const submitEvent = { preventDefault: jest.fn() } as unknown as React.FormEvent;

function respond(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
}

describe("useExternalEventForm", () => {
  it("legt mit vorbelegten Werten an, schließt und meldet das Ergebnis", async () => {
    respond(201, saved);
    const onSaved = jest.fn();
    const { result } = renderHook(() => useExternalEventForm(onSaved));

    act(() => result.current.openCreate({ startDate: "2026-11-06", endDate: "2026-11-06" }));
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.setData({ ...result.current.data, title: "RDL" }));
    await act(() => result.current.handleSubmit(submitEvent));

    const [url, init] = jest.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("/api/admin/fremdtermine");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({ title: "RDL", startDate: "2026-11-06", allDay: true, visibility: "MEMBER" });
    expect(onSaved).toHaveBeenCalledWith(saved, "created");
    expect(result.current.isOpen).toBe(false);
  });

  it("ändert per PUT und behält bei Fehlern Formular und Feldfehler", async () => {
    const fieldErrors = [{ field: "title", message: "Titel ist erforderlich" }];
    respond(400, { error: "Titel ist erforderlich", fieldErrors });
    const onSaved = jest.fn();
    const { result } = renderHook(() => useExternalEventForm(onSaved));

    act(() => result.current.openEdit(saved));
    expect(result.current.data.title).toBe("RDL");
    await act(() => result.current.handleSubmit(submitEvent));

    const [url, init] = jest.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("/api/admin/fremdtermine/e1");
    expect(init?.method).toBe("PUT");
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.isOpen).toBe(true);
    expect(result.current.error).toBe("Titel ist erforderlich");
    expect(result.current.fieldErrors).toEqual(fieldErrors);
  });

  it("meldet Netzwerkfehler auf Deutsch", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useExternalEventForm(jest.fn()));

    act(() => result.current.openCreate());
    await act(() => result.current.handleSubmit(submitEvent));
    expect(result.current.error).toMatch(/^Netzwerkfehler/);

    act(() => result.current.close());
    expect(result.current.error).toBe("");
  });
});
