import { render, screen } from "@testing-library/react";
import FormularePage from "@/app/info/formulare/page";

describe("FormularePage", () => {
  it("renders the new weapons transfer form download", () => {
    render(<FormularePage />);

    expect(screen.getByRole("heading", { name: "RAG MSE Formulare" })).toBeInTheDocument();
    expect(screen.getByText("Waffen überlassen")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Formular Waffenüberlassung" });

    expect(link).toHaveAttribute("href", "/dokumente/RAG_Ueberlassung_Waffen.pdf");
    expect(link).toHaveClass("document-download-link");
    expect(link).toHaveClass("document-download-link-download");
    expect(screen.getByText("Formular Waffenüberlassung")).toHaveClass("document-download-label");
    expect(screen.getByRole("link", { name: "Waffenrecht-Formulare des Landkreises" })).toHaveClass(
      "document-download-link-external"
    );
  });
});
