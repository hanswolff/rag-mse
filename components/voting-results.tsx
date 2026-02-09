import { VoteType } from "@prisma/client";
import { VOTE_OPTIONS } from "@/lib/vote-utils";
import { VotingPieChart } from "@/components/voting-pie-chart";
import { pluralize } from "@/lib/pluralization";

export interface Vote {
  id: string;
  vote: VoteType;
  user: {
    id: string;
    name: string;
  };
}

export interface VoteCounts {
  JA: number;
  NEIN: number;
  VIELLEICHT: number;
}

interface VotingResultsProps {
  votes?: Vote[];
  voteCounts: VoteCounts;
  isAdmin?: boolean;
}

export function VotingResults({ votes, voteCounts, isAdmin = false }: VotingResultsProps) {
  const totalVotes = voteCounts.JA + voteCounts.NEIN + voteCounts.VIELLEICHT;

  const votesByOption = VOTE_OPTIONS.map((option) => ({
    ...option,
    votes: votes?.filter((v) => v.vote === option.value) || [],
  }));

  return (
    <>
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
          Anmeldestand ({totalVotes} {pluralize(totalVotes, "Anmeldung", "Anmeldungen")})
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <VotingPieChart voteCounts={voteCounts} />
          </div>

          {isAdmin && votes && votes.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                Angemeldet sind:
              </h3>
              <div className="space-y-4">
                {votesByOption.map((option) => (
                  <div key={option.value}>
                    <div className={`text-sm font-semibold mb-2 px-2 py-1 rounded inline-block ${option.color}`}>
                      {option.label} ({option.votes.length})
                    </div>
                    <ul className="space-y-1.5 ml-2">
                      {option.votes.map((vote) => (
                        <li
                          key={vote.id}
                          className="text-gray-700 text-sm sm:text-base"
                        >
                          {vote.user.name}
                        </li>
                      ))}
                      {option.votes.length === 0 && (
                        <li className="text-gray-400 text-sm italic">
                          Keine Anmeldungen
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
