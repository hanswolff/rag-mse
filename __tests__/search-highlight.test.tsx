import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SearchHighlight } from "@/components/search-highlight";

describe("SearchHighlight", () => {
  it("renders plain text when query is empty", () => {
    render(<SearchHighlight text="Mitgliedsantrag Max" query="" />);
    expect(screen.getByText("Mitgliedsantrag Max")).toBeInTheDocument();
    expect(screen.queryByText("Max", { selector: "mark" })).not.toBeInTheDocument();
  });

  it("highlights matching parts case-insensitively", () => {
    render(<SearchHighlight text="Mitgliedsantrag Max Mustermann" query="max" />);
    const highlighted = screen.getByText("Max", { selector: "mark" });
    expect(highlighted).toBeInTheDocument();
  });

  it("escapes special regex characters in query", () => {
    render(<SearchHighlight text="a+b test" query="a+b" />);
    const highlighted = screen.getByText("a+b", { selector: "mark" });
    expect(highlighted).toBeInTheDocument();
  });

  it("highlights multiple matches", () => {
    render(<SearchHighlight text="Max und maxi" query="max" />);
    const highlighted = screen.getAllByText(/max/i, { selector: "mark" });
    expect(highlighted).toHaveLength(2);
  });

  it("handles null text without crashing", () => {
    const { container } = render(<SearchHighlight text={null} query="max" />);
    expect(container).toBeEmptyDOMElement();
  });
});
