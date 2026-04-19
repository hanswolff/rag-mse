import { render, screen } from "@testing-library/react";
import SachkundepruefungPage from "@/app/info/sachkundepruefung/page";

describe("SachkundepruefungPage", () => {
  it("renders both responsive document downloads", () => {
    render(<SachkundepruefungPage />);

    const links = [
      screen.getByRole("link", { name: "Fragenkatalog ohne Antworten (PDF)" }),
      screen.getByRole("link", { name: "Fragenkatalog mit Antworten (PDF)" }),
    ];

    expect(links).toHaveLength(2);

    for (const link of links) {
      expect(link).toHaveClass("document-download-link");
    }

    expect(screen.getByText("Fragenkatalog ohne Antworten (PDF)")).toHaveClass("document-download-label");
    expect(screen.getByText("Fragenkatalog mit Antworten (PDF)")).toHaveClass("document-download-label");
  });
});
