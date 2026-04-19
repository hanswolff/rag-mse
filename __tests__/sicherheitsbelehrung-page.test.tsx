import { render, screen } from "@testing-library/react";
import SicherheitsbelehrungPage from "@/app/info/sicherheitsbelehrung/page";

describe("SicherheitsbelehrungPage", () => {
  it("renders the weapons storage leaflet download", () => {
    render(<SicherheitsbelehrungPage />);

    expect(screen.getByRole("heading", { name: "Sicherheitsbelehrung" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Merkblatt zur Waffenaufbewahrung" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Merkblatt Waffenaufbewahrung (PDF)" });

    expect(link).toHaveAttribute("href", "/dokumente/Merkblatt_Waffenaufbewahrung.pdf");
    expect(link).toHaveClass("document-download-link");
    expect(link).toHaveClass("document-download-link-download");
    expect(link).toHaveClass("document-download-link-start");
    expect(screen.getByText("Merkblatt Waffenaufbewahrung (PDF)")).toHaveClass("document-download-label");
  });
});
