import { VoteType } from "@prisma/client";
import { VOTE_OPTIONS } from "@/lib/vote-utils";
import { VotingPieChart } from "@/components/voting-pie-chart";
import { formatRegistrationCount } from "@/lib/registration-count";
import { PlusIcon, CloseSmallIcon } from "@/components/icons";

export type EditableRegistration =
  | {
      type: "member";
      userId: string;
      name: string;
    }
  | {
      type: "guest";
      name: string;
    };

export interface Vote {
  id: string;
  vote: VoteType;
  user: {
    id: string;
    name: string;
  };
  registration?: EditableRegistration;
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
  onAddVote?: (vote: VoteType) => void;
  onRemoveVote?: (voteId: string, registration: EditableRegistration) => void;
  registrationActionKey?: string | null;
}

export function VotingResults({
  votes,
  voteCounts,
  isAdmin = false,
  onAddVote,
  onRemoveVote,
  registrationActionKey = null,
}: VotingResultsProps) {
  const registrationCountLabel = formatRegistrationCount(voteCounts);

  const votesByOption = VOTE_OPTIONS.map((option) => ({
    ...option,
    votes: votes?.filter((v) => v.vote === option.value) || [],
  }));

  return (
    <>
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
          Anmeldestand ({registrationCountLabel})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <VotingPieChart voteCounts={voteCounts} />
          </div>

          {isAdmin && (
            <div className="bg-white rounded-2xl shadow-md p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                Angemeldet sind:
              </h3>
              <div className="space-y-4">
                {votesByOption.map((option) => (
                  <div key={option.value}>
                    <div className="mb-2 flex items-center gap-2">
                      <div className={`text-sm font-semibold px-2 py-1 rounded inline-block ${option.color}`}>
                        {option.label} ({option.votes.length})
                      </div>
                      {onAddVote && (
                        <button
                          type="button"
                          onClick={() => onAddVote(option.value)}
                          className="btn-icon"
                          aria-label={`${option.label}: Anmeldung hinzufügen`}
                        >
                          <PlusIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <ul className="space-y-1.5 ml-2">
                      {option.votes.map((vote) => {
                        const registration = vote.registration;
                        return (
                        <li
                          key={vote.id}
                          className="text-gray-700 text-sm sm:text-base flex items-center gap-2"
                        >
                          <span>{vote.user.name}</span>
                          {registration && onRemoveVote && (
                            <button
                              type="button"
                              onClick={() => onRemoveVote(vote.id, registration)}
                              disabled={registrationActionKey === `delete-${vote.id}`}
                              className="btn-icon-danger"
                              aria-label={`${vote.user.name}: Anmeldung entfernen`}
                            >
                              <CloseSmallIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                        );
                      })}
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
