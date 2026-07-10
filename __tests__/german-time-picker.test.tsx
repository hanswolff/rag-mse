import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import "@testing-library/jest-dom";
import { GermanTimePicker } from "@/components/german-time-picker";

describe("GermanTimePicker", () => {
  it("shows the value in HH:mm format", () => {
    render(
      <GermanTimePicker
        id="test-time"
        label="Uhrzeit"
        value="09:30"
        onChange={() => undefined}
      />
    );

    expect(screen.getByLabelText("Uhrzeit")).toHaveValue("09:30");
  });

  it("supports keyboard input without losing focus between keystrokes", async () => {
    const user = userEvent.setup();

    function Wrapper() {
      const [value, setValue] = useState("");
      return (
        <GermanTimePicker
          id="test-time"
          label="Uhrzeit"
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<Wrapper />);

    const input = screen.getByLabelText("Uhrzeit");
    await user.click(input);
    // Vor dem Fix remountete `key={value}` den Picker bei jedem parsebaren
    // Tastendruck — der Fokus ging verloren und Folgezeichen landeten ins Leere.
    await user.type(input, "18:45");

    expect(input).toHaveFocus();
    await waitFor(() => {
      expect(input).toHaveValue("18:45");
    });
  });
});
