import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import "@testing-library/jest-dom";
import { GermanDatePicker } from "@/components/german-date-picker";

describe("GermanDatePicker", () => {
  it("shows ISO value in german format", () => {
    render(
      <GermanDatePicker
        id="test-date"
        label="Datum"
        value="2026-02-10"
        onChange={() => undefined}
      />
    );

    expect(screen.getByLabelText("Datum")).toHaveValue("10.02.2026");
  });

  it("supports full keyboard input including year", async () => {
    const user = userEvent.setup();

    function Wrapper() {
      const [value, setValue] = useState("");
      return (
        <GermanDatePicker
          id="test-date"
          label="Datum"
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<Wrapper />);

    const input = screen.getByLabelText("Datum");
    await user.click(input);
    await user.type(input, "10.02.2026");

    await waitFor(() => {
      expect(input).toHaveValue("10.02.2026");
    });
  });

  it("does not commit implausible partial years while typing", async () => {
    const user = userEvent.setup();
    const committedValues: string[] = [];

    function Wrapper() {
      const [value, setValue] = useState("");
      return (
        <GermanDatePicker
          id="test-date"
          label="Datum"
          value={value}
          onChange={(next) => {
            committedValues.push(next);
            setValue(next);
          }}
        />
      );
    }

    render(<Wrapper />);

    const input = screen.getByLabelText("Datum");
    await user.click(input);
    await user.type(input, "12.03.2026");

    await waitFor(() => {
      expect(input).toHaveValue("12.03.2026");
    });

    // Während des Tippens von "12.03.20…" darf kein Jahr wie 0020 gespeichert werden
    expect(committedValues.every((v) => v === "" || v.startsWith("2026-"))).toBe(true);
    expect(committedValues).toContain("2026-03-12");
  });
});
