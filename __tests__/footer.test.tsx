import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/footer";

describe("Footer", () => {
  it("renders footer with all sections", () => {
    render(<Footer />);

    expect(screen.getByText("RAG Schießsport MSE")).toBeInTheDocument();
    expect(screen.getByText("Rechtliches")).toBeInTheDocument();
    expect(screen.getByText("Links")).toBeInTheDocument();
  });

  it("renders footer sections in correct order", () => {
    render(<Footer />);

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(3);
    expect(headings[0]).toHaveTextContent("RAG Schießsport MSE");
    expect(headings[1]).toHaveTextContent("Links");
    expect(headings[2]).toHaveTextContent("Rechtliches");
  });

  it("renders legal links", () => {
    render(<Footer />);

    expect(screen.getByText("Impressum")).toBeInTheDocument();
    expect(screen.getByText("Datenschutzerklärung")).toBeInTheDocument();
  });

  it("renders external links", () => {
    render(<Footer />);

    const githubLink = screen.getByText("GitHub");
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute("href", "https://github.com/hanswolff/rag-mse");
    expect(githubLink).toHaveAttribute("target", "_blank");
    expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders copyright section", () => {
    render(<Footer />);

    const currentYear = new Date().getFullYear().toString();
    const copyrightText = screen.getByText((content) =>
      content.includes(`© ${currentYear} RAG Schießsport MSE`)
    );
    expect(copyrightText).toBeInTheDocument();
    expect(copyrightText).toHaveClass("text-gray-400");
  });

  it("renders version and build date", () => {
    render(<Footer />);

    const versionText = screen.getByText(/v\d+\.\d+\.\d+/);
    expect(versionText).toBeInTheDocument();
    expect(versionText).toHaveTextContent(/Build-Datum:/);
  });

  it("has consistent spacing across all section headings", () => {
    render(<Footer />);

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(3);

    headings.forEach((heading) => {
      expect(heading).toHaveClass("mb-2", "sm:mb-2.5");
    });
  });
});
