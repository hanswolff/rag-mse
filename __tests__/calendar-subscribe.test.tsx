import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildCalendarFeedUrls, CalendarSubscribe } from "@/components/calendar/calendar-subscribe";

describe("buildCalendarFeedUrls", () => {
  it("builds https and webcal URLs", () => {
    expect(buildCalendarFeedUrls("https://rag-mse.de/")).toEqual({
      feedUrl: "https://rag-mse.de/kalender.ics",
      webcalUrl: "webcal://rag-mse.de/kalender.ics",
    });
  });

  it("maps plain http origins to webcal as well", () => {
    expect(buildCalendarFeedUrls("http://localhost:3000").webcalUrl).toBe("webcal://localhost:3000/kalender.ics");
  });
});

describe("CalendarSubscribe", () => {
  it("shows the feed URL from the current origin, copies it and links webcal", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const origin = window.location.origin;

    render(<CalendarSubscribe />);

    expect(screen.getByRole("heading", { name: "Kalender abonnieren" })).toBeInTheDocument();
    expect(screen.getByText(`${origin}/kalender.ics`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "In Kalender-App öffnen" })).toHaveAttribute(
      "href",
      `${origin.replace(/^https?:/, "webcal:")}/kalender.ics`
    );

    await userEvent.click(screen.getByRole("button", { name: `Abo-Adresse kopieren: ${origin}/kalender.ics` }));

    expect(writeText).toHaveBeenCalledWith(`${origin}/kalender.ics`);
    expect(screen.getByRole("button", { name: "Abo-Adresse kopiert" })).toBeInTheDocument();
  });
});
