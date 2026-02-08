import { render, screen } from "@testing-library/react";
import ImpressumPage from "../app/impressum/page";

describe("ImpressumPage", () => {
  it("renders the main heading", () => {
    render(<ImpressumPage />);
    const heading = screen.getByRole("heading", { name: "Impressum" });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe("H1");
  });

  it("renders contact section", () => {
    render(<ImpressumPage />);
    const heading = screen.getByRole("heading", { name: /Kontakt/i });
    expect(heading).toBeInTheDocument();
  });

  it("renders email as image", () => {
    render(<ImpressumPage />);
    const emailImage = screen.getByAltText("E-Mail-Adresse");
    expect(emailImage).toBeInTheDocument();
    expect(emailImage).toHaveAttribute("src", "/email/kontakt.svg");
  });

  it("renders legal information sections", () => {
    render(<ImpressumPage />);
    expect(
      screen.getByRole("heading", { name: /Angaben gemäß § 5/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Verantwortlich für den Inhalt gemäß § 18 Abs\. 2 MStV/i })
    ).toBeInTheDocument();
  });

  it("renders liability sections", () => {
    render(<ImpressumPage />);
    expect(
      screen.getByRole("heading", { name: "Haftung für Inhalte" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Haftung für Links" })
    ).toBeInTheDocument();
  });

  it("renders consumer dispute resolution section", () => {
    render(<ImpressumPage />);
    expect(
      screen.getByRole("heading", {
        name: /Verbraucherstreitbeilegung/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nicht bereit oder verpflichtet/i)
    ).toBeInTheDocument();
  });

  it("renders back to home link", () => {
    render(<ImpressumPage />);
    const link = screen.getByRole("link", { name: "Zurück zur Startseite" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders the main element", () => {
    const { container } = render(<ImpressumPage />);
    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
  });

  it("renders multiple sections", () => {
    const { container } = render(<ImpressumPage />);
    const sections = container.querySelectorAll("section");
    expect(sections.length).toBeGreaterThan(1);
  });
});
