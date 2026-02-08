import { render, screen } from "@testing-library/react";
import DatenschutzPage from "../app/datenschutz/page";

describe("DatenschutzPage", () => {
  it("renders the main heading", () => {
    render(<DatenschutzPage />);
    const heading = screen.getByRole("heading", { name: "Datenschutzerklärung" });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe("H1");
  });

  it("renders data protection overview section", () => {
    render(<DatenschutzPage />);
    const heading = screen.getByRole("heading", {
      name: "1. Datenschutz auf einen Blick",
    });
    expect(heading).toBeInTheDocument();
  });

  it("renders cookie information", () => {
    render(<DatenschutzPage />);
    expect(screen.getByText(/Session-Cookies/i)).toBeInTheDocument();
  });

  it("renders hosting section", () => {
    render(<DatenschutzPage />);
    const heading = screen.getByRole("heading", {
      name: "3. Hosting und Server-Logs",
    });
    expect(heading).toBeInTheDocument();
  });

  it("renders contact form section", () => {
    render(<DatenschutzPage />);
    const heading = screen.getByRole("heading", {
      name: "7. Kontaktformular und E-Mail",
    });
    expect(heading).toBeInTheDocument();
    expect(screen.getAllByText(/Einwilligung/i).length).toBeGreaterThan(0);
  });

  it("renders data subject rights section", () => {
    render(<DatenschutzPage />);
    const heading = screen.getByRole("heading", {
      name: "10. Rechte der betroffenen Person",
    });
    expect(heading).toBeInTheDocument();
  });

  it("renders contact for data protection section", () => {
    render(<DatenschutzPage />);
    const heading = screen.getByRole("heading", {
      name: "11. Kontakt für Datenschutz",
    });
    expect(heading).toBeInTheDocument();
    const emailImage = screen.getByAltText("E-Mail-Adresse");
    expect(emailImage).toBeInTheDocument();
    expect(emailImage).toHaveAttribute("src", "/email/datenschutz.svg");
  });

  it("renders back to home link", () => {
    render(<DatenschutzPage />);
    const link = screen.getByRole("link", { name: "Zurück zur Startseite" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders the main element", () => {
    const { container } = render(<DatenschutzPage />);
    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
  });

  it("renders all numbered sections", () => {
    render(<DatenschutzPage />);
    expect(screen.getByText(/^1\./)).toBeInTheDocument();
    expect(screen.getByText(/^2\./)).toBeInTheDocument();
    expect(screen.getByText(/^3\./)).toBeInTheDocument();
    expect(screen.getByText(/^4\./)).toBeInTheDocument();
    expect(screen.getByText(/^5\./)).toBeInTheDocument();
    expect(screen.getByText(/^6\./)).toBeInTheDocument();
    expect(screen.getByText(/^7\./)).toBeInTheDocument();
    expect(screen.getByText(/^8\./)).toBeInTheDocument();
    expect(screen.getByText(/^9\./)).toBeInTheDocument();
    expect(screen.getByText(/^10\./)).toBeInTheDocument();
    expect(screen.getByText(/^11\./)).toBeInTheDocument();
  });
});
