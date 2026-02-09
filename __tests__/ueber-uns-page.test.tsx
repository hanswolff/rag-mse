import { render, screen } from "@testing-library/react";
import UeberUnsPage from "@/app/ueber-uns/page";

describe("UeberUnsPage", () => {
  it("renders page heading and moved about text", () => {
    render(<UeberUnsPage />);

    expect(screen.getByRole("heading", { name: "Über die RAG Schießsport MSE" })).toBeInTheDocument();
    expect(
      screen.getByText(/Die RAG Schießsport MSE ist eine Reservistenarbeitsgemeinschaft/)
    ).toBeInTheDocument();
  });

  it("renders both board members with role and portrait", () => {
    render(<UeberUnsPage />);

    expect(screen.getByText("Jörg Teske")).toBeInTheDocument();
    expect(screen.getByText("Vorstandsvorsitzender")).toBeInTheDocument();
    expect(screen.getByAltText("Portrait von Jörg Teske")).toBeInTheDocument();

    expect(screen.getByText("Hans Wolff")).toBeInTheDocument();
    expect(screen.getByText("Stellvertretender Vorstandsvorsitzender")).toBeInTheDocument();
    expect(screen.getByAltText("Portrait von Hans Wolff")).toBeInTheDocument();
  });
});
