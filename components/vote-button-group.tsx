"use client";

import { LoadingButton } from "@/components/loading-button";
import { VOTE_OPTIONS, type VoteOption } from "@/lib/vote-utils";

type VoteValue = VoteOption["value"];

interface VoteButtonGroupProps {
  currentVote: string | null | undefined;
  onVote: (vote: VoteValue) => void;
  isVoting: boolean;
  pendingVote: string | null | undefined;
  disabled?: boolean;
  gridClassName?: string;
  buttonClassName?: string;
}

// Ja/Nein/Vielleicht-Auswahl der Teilnahmeanmeldung (Termin-Detail und
// Anmeldung per RSVP-Link).
export function VoteButtonGroup({
  currentVote,
  onVote,
  isVoting,
  pendingVote,
  disabled = false,
  gridClassName = "grid grid-cols-1 sm:grid-cols-3 gap-3",
  buttonClassName = "px-4 py-3 rounded-lg font-medium border-2 transition-all",
}: VoteButtonGroupProps) {
  return (
    <div className={gridClassName}>
      {VOTE_OPTIONS.map((option) => (
        <LoadingButton
          key={option.value}
          type="button"
          aria-pressed={currentVote === option.value}
          onClick={() => onVote(option.value)}
          disabled={disabled}
          loading={isVoting && pendingVote === option.value}
          loadingText={option.label}
          className={`${buttonClassName} ${
            currentVote === option.value
              ? `${option.color} border-current`
              : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
          }`}
        >
          {option.label}
        </LoadingButton>
      ))}
    </div>
  );
}
