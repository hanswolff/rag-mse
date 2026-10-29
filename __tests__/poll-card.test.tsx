import { render, screen } from "@testing-library/react";
import { PollCard } from "@/components/poll-card";
import { PollStatusBadge, PollVoteBadge } from "@/components/poll-status-badge";
import type { Poll } from "@/types";

const basePoll: Poll = {
  id: "p1",
  title: "Weihnachtsfeier",
  description: "Wann passt es euch?",
  type: "SONSTIGES",
  status: "LIVE",
  multipleChoice: false,
  shortCode: "abc123",
  options: [
    { id: "o1", text: "Freitag", position: 0, _count: { votes: 3 } },
    { id: "o2", text: "Samstag", position: 1, _count: { votes: 2 } },
  ],
  _count: { votes: 5 },
  userVoteOptionIds: [],
  event: null,
};

describe("PollStatusBadge", () => {
  it("shows a red Geschlossen badge for closed polls", () => {
    render(<PollStatusBadge status="CLOSED" />);
    expect(screen.getByText("Geschlossen").className).toContain("bg-red-100");
  });

  it("shows a green Offen badge for live polls", () => {
    render(<PollStatusBadge status="LIVE" />);
    expect(screen.getByText("Offen").className).toContain("bg-green-100");
  });
});

describe("PollVoteBadge", () => {
  it("shows Abgestimmt in green after voting", () => {
    render(<PollVoteBadge hasVoted />);
    expect(screen.getByText("Abgestimmt").className).toContain("bg-green-100");
  });

  it("shows Offen in amber before voting", () => {
    render(<PollVoteBadge hasVoted={false} />);
    expect(screen.getByText("Offen").className).toContain("bg-amber-100");
  });
});

describe("PollCard", () => {
  it("links to the poll detail page", () => {
    render(<PollCard poll={basePoll} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/umfragen/p1");
  });

  it("shows type badge, description, and vote summary", () => {
    render(<PollCard poll={basePoll} />);
    expect(screen.getByText("Sonstiges")).toBeInTheDocument();
    expect(screen.getByText("Wann passt es euch?")).toBeInTheDocument();
    expect(screen.getByText("2 Optionen · 5 Stimmen abgegeben")).toBeInTheDocument();
  });

  it("shows the amber Offen badge when the user has not voted yet", () => {
    render(<PollCard poll={basePoll} />);
    expect(screen.getByText("Offen").className).toContain("bg-amber-100");
  });

  it("shows Abgestimmt when the user has voted", () => {
    render(<PollCard poll={{ ...basePoll, userVoteOptionIds: ["o1"] }} />);
    expect(screen.getByText("Abgestimmt")).toBeInTheDocument();
  });

  it("shows Geschlossen instead of the vote state for closed polls", () => {
    render(<PollCard poll={{ ...basePoll, status: "CLOSED", userVoteOptionIds: ["o1"] }} />);
    expect(screen.getByText("Geschlossen")).toBeInTheDocument();
    expect(screen.queryByText("Abgestimmt")).not.toBeInTheDocument();
  });

  it("shows the Mehrfachauswahl badge for multiple-choice polls", () => {
    render(<PollCard poll={{ ...basePoll, multipleChoice: true }} />);
    expect(screen.getByText("Mehrfachauswahl")).toBeInTheDocument();
  });

  it("shows the linked Termin details for TERMIN polls", () => {
    render(
      <PollCard
        poll={{
          ...basePoll,
          type: "TERMIN",
          event: {
            id: "e1",
            date: "2026-08-20",
            timeFrom: "18:00",
            timeTo: "20:00",
            location: "Stand A",
            description: "Training",
          },
        }}
      />
    );
    expect(screen.getByText("20.08.2026, 18:00 – 20:00 Uhr")).toBeInTheDocument();
    expect(screen.getByText("Stand A")).toBeInTheDocument();
  });

  describe("archive variant", () => {
    it("shows a green Offen badge instead of the vote state", () => {
      render(<PollCard poll={basePoll} variant="archive" />);
      expect(screen.getByText("Offen").className).toContain("bg-green-100");
    });

    it("hides the Mehrfachauswahl badge", () => {
      render(<PollCard poll={{ ...basePoll, multipleChoice: true }} variant="archive" />);
      expect(screen.queryByText("Mehrfachauswahl")).not.toBeInTheDocument();
    });

    it("shows Geschlossen for closed polls", () => {
      render(<PollCard poll={{ ...basePoll, status: "CLOSED" }} variant="archive" />);
      expect(screen.getByText("Geschlossen")).toBeInTheDocument();
    });
  });

  describe("compact variant", () => {
    it("shows the vote state and a shortened vote summary", () => {
      render(<PollCard poll={basePoll} variant="compact" />);
      expect(screen.getByText("Offen").className).toContain("text-xs");
      expect(screen.getByText("2 Optionen · 5 Stimmen")).toBeInTheDocument();
      expect(screen.queryByText("Sonstiges")).not.toBeInTheDocument();
    });

    it("shows the vote state alongside Geschlossen for closed polls", () => {
      render(
        <PollCard
          poll={{ ...basePoll, status: "CLOSED", userVoteOptionIds: ["o1"] }}
          variant="compact"
        />
      );
      expect(screen.getByText("Abgestimmt")).toBeInTheDocument();
      expect(screen.getByText("Geschlossen")).toBeInTheDocument();
    });
  });
});
