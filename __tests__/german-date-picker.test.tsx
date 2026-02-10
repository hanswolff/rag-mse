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
});
