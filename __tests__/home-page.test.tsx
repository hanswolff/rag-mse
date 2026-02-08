import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home", () => {
  it("renders hero section with title and description", () => {
    render(<Home />);

    expect(
      screen.getByText("RAG Schießsport MSE")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Willkommen auf der Website der RAG Schießsport MSE"
      )
    ).toBeInTheDocument();
  });

  it("renders call to action buttons", () => {
    render(<Home />);

    expect(screen.getByText("Aktuelle Termine")).toBeInTheDocument();
    expect(screen.getByText("Kontakt aufnehmen")).toBeInTheDocument();
  });

  it("renders feature cards section", () => {
    render(<Home />);

    expect(screen.getByText("Unser Angebot")).toBeInTheDocument();
    expect(screen.getByText("Termine")).toBeInTheDocument();
    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getByText("Kontakt")).toBeInTheDocument();
  });

  it("renders about section", () => {
    render(<Home />);

    expect(
      screen.getByText("Über die RAG Schießsport MSE")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Die RAG Schießsport MSE ist eine Reservistenarbeitsgemeinschaft/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Im Mittelpunkt stehen sportliches Schießen/)
    ).toBeInTheDocument();
  });

  it("renders feature card descriptions", () => {
    render(<Home />);

    expect(
      screen.getByText(
        /Informieren Sie sich über anstehende Veranstaltungen/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Bleiben Sie auf dem Laufenden/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Haben Sie Fragen\? Schreiben Sie uns/)
    ).toBeInTheDocument();
  });
});
