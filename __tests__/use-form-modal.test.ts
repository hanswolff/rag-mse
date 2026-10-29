import { act, renderHook } from "@testing-library/react";
import { z } from "zod";
import { useFormModal } from "@/lib/use-form-modal";

interface Form {
  startDate: string;
  reason: string;
}

const KEYWORDS = { startDate: ["Startdatum"], reason: ["Grund"] };
const CONFIG = { startDate: { zod: z.string() }, reason: { zod: z.string() } };
const FIELD_ERRORS = [
  { field: "startDate", message: "Startdatum liegt zu weit zurück" },
  { field: "reason", message: "Grund ist unzulässig" },
];

function renderForm(formData: Form) {
  return renderHook(
    ({ data }: { data: Form }) =>
      useFormModal<Form>({
        validationConfig: CONFIG,
        formData: data,
        setFormData: jest.fn(),
        isOpen: true,
        isSubmitting: false,
        onClose: jest.fn(),
        onSubmit: jest.fn(),
        serverErrors: { general: "Startdatum liegt zu weit zurück" },
        fieldErrors: FIELD_ERRORS,
        fieldKeywords: KEYWORDS,
      }),
    { initialProps: { data: formData } }
  );
}

describe("useFormModal – Serverfehler am Feld", () => {
  it("zeigt zugeordnete Serverfehler, auch wenn die Clientprüfung nichts findet", () => {
    const { result } = renderForm({ startDate: "2020-01-01", reason: "Urlaub" });
    expect(result.current.getFieldError("startDate")).toBe("Startdatum liegt zu weit zurück");
    expect(result.current.getFieldError("reason")).toBe("Grund ist unzulässig");
  });

  it("verwirft den Serverfehler eines Feldes, sobald es geändert wird, und behält die übrigen", () => {
    const { result, rerender } = renderForm({ startDate: "2020-01-01", reason: "Urlaub" });
    act(() => rerender({ data: { startDate: "2026-11-06", reason: "Urlaub" } }));
    expect(result.current.getFieldError("startDate")).toBeUndefined();
    expect(result.current.combinedErrors.startDate).toBeUndefined();
    expect(result.current.getFieldError("reason")).toBe("Grund ist unzulässig");
  });
});
