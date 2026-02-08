import { render, screen } from "@testing-library/react";
import Home from "../app/page";

describe("Home", () => {
  it("renders the main heading", () => {
    render(<Home />);
    const heading = screen.getByRole("heading", {
      name: "RAG Schießsport MSE",
    });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe("H1");
  });

  it("renders the welcome message", () => {
    render(<Home />);
    const message = screen.getByText(
      "Willkommen auf der Website der RAG Schießsport MSE"
    );
    expect(message).toBeInTheDocument();
    expect(message.tagName).toBe("P");
  });

  it("renders the main element", () => {
    const { container } = render(<Home />);
    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
  });

  it("renders the section element", () => {
    const { container } = render(<Home />);
    const section = container.querySelector("section");
    expect(section).toBeInTheDocument();
  });
});
