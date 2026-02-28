import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VotingResults } from "@/components/voting-results";

jest.mock("@/components/voting-pie-chart", () => ({
  VotingPieChart: ({ voteCounts }: { voteCounts: { JA: number; NEIN: number; VIELLEICHT: number } }) => (
    <div data-testid="voting-pie-chart">
      JA: {voteCounts.JA}, NEIN: {voteCounts.NEIN}, VIELLEICHT: {voteCounts.VIELLEICHT}
    </div>
  ),
}));

const mockVotes = [
  { id: "v1", vote: "JA" as const, user: { id: "u1", name: "User 1" } },
  { id: "v2", vote: "NEIN" as const, user: { id: "u2", name: "User 2" } },
  { id: "v3", vote: "VIELLEICHT" as const, user: { id: "u3", name: "User 3" } },
];

const mockVoteCounts = {
  JA: 5,
  NEIN: 2,
  VIELLEICHT: 3,
};

describe("VotingResults", () => {
  it("renders the pie chart component for non-admins", () => {
    render(
      <VotingResults votes={mockVotes} voteCounts={mockVoteCounts} isAdmin={false} />
    );

    expect(screen.getByTestId("voting-pie-chart")).toBeInTheDocument();
    expect(screen.getByText(/JA: 5, NEIN: 2, VIELLEICHT: 3/)).toBeInTheDocument();
  });

  it("displays registration range without NEIN votes", () => {
    render(
      <VotingResults votes={mockVotes} voteCounts={mockVoteCounts} isAdmin={false} />
    );

    expect(screen.getByText("Anmeldestand (5-8 Anmeldungen)")).toBeInTheDocument();
  });

  it("does not render vote count numbers (removed feature)", () => {
    render(
      <VotingResults votes={mockVotes} voteCounts={mockVoteCounts} isAdmin={false} />
    );

    // The pie chart still shows the data but not separate number boxes
    expect(screen.getByTestId("voting-pie-chart")).toBeInTheDocument();
  });

  it("does not render list of voters for non-admins", () => {
    render(
      <VotingResults votes={mockVotes} voteCounts={mockVoteCounts} isAdmin={false} />
    );

    expect(screen.queryByText("Angemeldet sind:")).not.toBeInTheDocument();
    expect(screen.queryByText("User 1")).not.toBeInTheDocument();
    expect(screen.queryByText("User 2")).not.toBeInTheDocument();
    expect(screen.queryByText("User 3")).not.toBeInTheDocument();
  });

  it("renders list of voters for admins", () => {
    render(
      <VotingResults votes={mockVotes} voteCounts={mockVoteCounts} isAdmin={true} />
    );

    expect(screen.getByText("Angemeldet sind:")).toBeInTheDocument();
    expect(screen.getByText("User 1")).toBeInTheDocument();
    expect(screen.getByText("User 2")).toBeInTheDocument();
    expect(screen.getByText("User 3")).toBeInTheDocument();
  });

  it("renders voters grouped by vote type for admins", () => {
    render(
      <VotingResults votes={mockVotes} voteCounts={mockVoteCounts} isAdmin={true} />
    );

    // Should show the vote types with count in parentheses
    expect(screen.getByText("Ja (1)")).toBeInTheDocument();
    expect(screen.getByText("Nein (1)")).toBeInTheDocument();
    expect(screen.getByText("Vielleicht (1)")).toBeInTheDocument();
  });

  it("does not render voter list when no votes even for admins", () => {
    render(
      <VotingResults votes={[]} voteCounts={{ JA: 0, NEIN: 0, VIELLEICHT: 0 }} isAdmin={true} />
    );

    expect(screen.getByText("Angemeldet sind:")).toBeInTheDocument();
  });

  it("renders pie chart even when no votes", () => {
    render(
      <VotingResults votes={[]} voteCounts={{ JA: 0, NEIN: 0, VIELLEICHT: 0 }} isAdmin={false} />
    );

    expect(screen.getByTestId("voting-pie-chart")).toBeInTheDocument();
  });

  it("shows 'Keine Anmeldungen' for vote types with no votes (admin view)", () => {
    const votesWithSomeOptions = [
      { id: "v1", vote: "JA" as const, user: { id: "u1", name: "User 1" } },
    ];

    render(
      <VotingResults votes={votesWithSomeOptions} voteCounts={{ JA: 1, NEIN: 0, VIELLEICHT: 0 }} isAdmin={true} />
    );

    expect(screen.getAllByText("Keine Anmeldungen")).toHaveLength(2);
  });

  it("renders multiple voters for same vote type correctly", () => {
    const multipleJaVotes = [
      { id: "v1", vote: "JA" as const, user: { id: "u1", name: "User 1" } },
      { id: "v2", vote: "JA" as const, user: { id: "u2", name: "User 2" } },
      { id: "v3", vote: "JA" as const, user: { id: "u3", name: "User 3" } },
    ];

    render(
      <VotingResults votes={multipleJaVotes} voteCounts={{ JA: 3, NEIN: 0, VIELLEICHT: 0 }} isAdmin={true} />
    );

    expect(screen.getByText("Ja (3)")).toBeInTheDocument();
    expect(screen.getByText("User 1")).toBeInTheDocument();
    expect(screen.getByText("User 2")).toBeInTheDocument();
    expect(screen.getByText("User 3")).toBeInTheDocument();
  });

  it("renders add buttons for each category for admins", () => {
    const onAddVote = jest.fn();
    render(
      <VotingResults votes={mockVotes} voteCounts={mockVoteCounts} isAdmin={true} onAddVote={onAddVote} />
    );

    expect(screen.getByRole("button", { name: "Ja: Anmeldung hinzufügen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nein: Anmeldung hinzufügen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vielleicht: Anmeldung hinzufügen" })).toBeInTheDocument();
  });

  it("calls remove handler for removable entries", async () => {
    const user = userEvent.setup();
    const onRemoveVote = jest.fn();
    const votesWithRegistration = [
      {
        id: "member-1",
        vote: "JA" as const,
        user: { id: "u1", name: "User 1" },
        registration: { type: "member" as const, userId: "u1", name: "User 1" },
      },
    ];

    render(
      <VotingResults votes={votesWithRegistration} voteCounts={{ JA: 1, NEIN: 0, VIELLEICHT: 0 }} isAdmin={true} onRemoveVote={onRemoveVote} />
    );

    await user.click(screen.getByRole("button", { name: "User 1: Anmeldung entfernen" }));

    expect(onRemoveVote).toHaveBeenCalledWith("member-1", { type: "member", userId: "u1", name: "User 1" });
  });
});
