import { render, screen } from "@testing-library/react";
import { VotingPieChart } from "@/components/voting-pie-chart";

const mockVoteCounts = {
  JA: 5,
  NEIN: 2,
  VIELLEICHT: 3,
};

describe("VotingPieChart", () => {
  it("renders empty state when no votes", () => {
    render(<VotingPieChart voteCounts={{ JA: 0, NEIN: 0, VIELLEICHT: 0 }} />);

    expect(screen.getByText("Noch keine Teilnahmeanmeldungen vorhanden")).toBeInTheDocument();
  });

  it("renders chart svg when votes exist", () => {
    const { container } = render(<VotingPieChart voteCounts={mockVoteCounts} />);

    expect(screen.queryByText("Noch keine Teilnahmeanmeldungen vorhanden")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders legend items for non-zero vote options", () => {
    render(<VotingPieChart voteCounts={{ JA: 1, NEIN: 0, VIELLEICHT: 1 }} />);

    expect(screen.getByText("Ja")).toBeInTheDocument();
    expect(screen.getByText("Vielleicht")).toBeInTheDocument();
    expect(screen.queryByText("Nein")).not.toBeInTheDocument();
  });
});
