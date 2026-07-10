"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { LoadingButton } from "@/components/loading-button";
import { LoadingScreen } from "@/components/loading-screen";
import { useProtectedPage } from "@/lib/use-protected-page";
import { AlertBox } from "@/components/alert-box";
import { CopyLinkButton } from "@/components/copy-link-button";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { formatDate } from "@/lib/date-utils";

// Event to notify navigation to refresh poll badge
const POLL_VOTE_CHANGED_EVENT = "poll-vote-changed";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

interface PollOption {
  id: string;
  text: string;
  position: number;
  _count: { votes: number };
}

interface PollDetail {
  id: string;
  title: string;
  description: string | null;
  type: "TERMIN" | "SONSTIGES";
  status: "LIVE" | "CLOSED";
  multipleChoice: boolean;
  shortCode: string | null;
  options: PollOption[];
  _count: { votes: number };
  userVoteOptionIds: string[];
  event?: { id: string; date: string; timeFrom: string; timeTo: string; location: string; description: string } | null;
}

export default function PollDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { status } = useProtectedPage();
  const [poll, setPoll] = useState<PollDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [isVoting, setIsVoting] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState("");

  const fetchPoll = useCallback(async () => {
    try {
      const response = await fetchWithTimeout(`/api/polls/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push("/umfragen");
          return;
        }
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Laden");
      }
      const data = await response.json();
      setPoll(data);
      setSelectedOptions(new Set(data.userVoteOptionIds));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void fetchPoll();
  }, [status, fetchPoll]);

  const handleOptionToggle = (optionId: string) => {
    if (!poll || poll.status !== "LIVE") return;

    setSelectedOptions((prev) => {
      const next = new Set(prev);
      if (poll.multipleChoice) {
        if (next.has(optionId)) {
          next.delete(optionId);
        } else {
          next.add(optionId);
        }
      } else {
        next.clear();
        next.add(optionId);
      }
      return next;
    });
  };

  const handleVote = async () => {
    if (!poll || selectedOptions.size === 0) return;

    setIsVoting(true);
    setError("");
    setVoteSuccess("");

    try {
      const response = await fetchWithTimeout(`/api/polls/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: Array.from(selectedOptions) }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Abstimmen");
      }

      setVoteSuccess("Ihre Stimme wurde gespeichert");
      window.dispatchEvent(new CustomEvent(POLL_VOTE_CHANGED_EVENT));
      await fetchPoll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsVoting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!poll) return;

    setIsWithdrawing(true);
    setError("");
    setVoteSuccess("");

    try {
      const response = await fetchWithTimeout(`/api/polls/${id}/vote`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Zurückziehen");
      }

      setVoteSuccess("Ihre Stimme wurde zurückgezogen");
      setSelectedOptions(new Set());
      window.dispatchEvent(new CustomEvent(POLL_VOTE_CHANGED_EVENT));
      await fetchPoll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!poll) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="text-gray-600">Umfrage nicht gefunden</div>
      </main>
    );
  }

  const totalVotes = poll.options.reduce((sum, opt) => sum + opt._count.votes, 0);
  const hasVoted = poll.userVoteOptionIds.length > 0;
  const isLive = poll.status === "LIVE";
  const hasSelectionChanged =
    selectedOptions.size !== poll.userVoteOptionIds.length ||
    !poll.userVoteOptionIds.every((id) => selectedOptions.has(id));

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{poll.title}</h1>
          {poll.description && (
            <p className="text-gray-600 mt-2">{poll.description}</p>
          )}
          {poll.type === "TERMIN" && poll.event && (
            <Link
              href={`/termine/${poll.event.id}`}
              className="block rounded-lg border border-brand-blue-200 bg-brand-blue-50 px-4 py-3 hover:bg-brand-blue-100 transition-colors mt-3"
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">📅</span>
                <div>
                  <p className="text-sm font-semibold text-brand-blue-900">Verknüpfter Termin</p>
                  <p className="text-sm text-brand-blue-800 mt-1">
                    {formatDate(poll.event.date)}, {poll.event.timeFrom} – {poll.event.timeTo} Uhr
                  </p>
                  <p className="text-sm text-brand-blue-700">{poll.event.location}</p>
                </div>
              </div>
            </Link>
          )}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {poll.status === "CLOSED" && (
              <span className="px-2 py-0.5 text-sm font-medium rounded bg-red-100 text-red-800">
                Geschlossen
              </span>
            )}
            {poll.multipleChoice && (
              <span className="px-2 py-0.5 text-sm font-medium rounded bg-purple-50 text-purple-800">
                Mehrfachauswahl möglich
              </span>
            )}
            <span className="text-sm text-gray-500">
              {totalVotes} {totalVotes === 1 ? "Stimme" : "Stimmen"} abgegeben
            </span>
          </div>
          {poll.shortCode && (
            <CopyLinkButton url={`${siteUrl}/u/${poll.shortCode}`} compact className="mt-3" />
          )}
        </div>

        <AlertBox type="error" message={error} className="mb-4" />

        <AlertBox type="success" message={voteSuccess} className="mb-4" />

        <div className="card">
          <div className="space-y-3">
            {poll.options.map((option) => {
              const isSelected = selectedOptions.has(option.id);
              const percentage = totalVotes > 0 ? Math.round((option._count.votes / totalVotes) * 100) : 0;
              const isUserVote = poll.userVoteOptionIds.includes(option.id);

              return (
                <div key={option.id} className="relative">
                  <button
                    type="button"
                    onClick={() => handleOptionToggle(option.id)}
                    disabled={!isLive || isVoting || isWithdrawing}
                    role={poll.multipleChoice ? "checkbox" : "radio"}
                    aria-checked={isSelected}
                    className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all relative overflow-hidden ${
                      isSelected
                        ? "border-brand-red-600 bg-brand-red-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    } ${!isLive ? "cursor-default" : "cursor-pointer"}`}
                  >
                    {(hasVoted || !isLive) && (
                      <div
                        className="absolute inset-y-0 left-0 bg-brand-blue-50/60 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    )}
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {isLive && (
                          <div className={`shrink-0 w-5 h-5 ${poll.multipleChoice ? "rounded" : "rounded-full"} border-2 flex items-center justify-center ${
                            isSelected ? "border-brand-red-600 bg-brand-red-600" : "border-gray-300"
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        )}
                        <span className={`font-medium ${isSelected ? "text-brand-red-900" : "text-gray-900"}`}>
                          {option.text}
                        </span>
                        {isUserVote && (
                          <span className="text-xs font-medium text-brand-red-700">Ihre Stimme</span>
                        )}
                      </div>
                      <div className="shrink-0 text-sm text-gray-600">
                        {(hasVoted || !isLive) && (
                          <span>{percentage}% ({option._count.votes})</span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {isLive && (
            <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t">
              <LoadingButton
                type="button"
                onClick={() => void handleVote()}
                loading={isVoting}
                loadingText="Wird gespeichert..."
                disabled={selectedOptions.size === 0 || !hasSelectionChanged || isVoting || isWithdrawing}
                className="btn-primary"
              >
                {hasVoted ? "Stimme ändern" : "Abstimmen"}
              </LoadingButton>
              {hasVoted && (
                <LoadingButton
                  type="button"
                  onClick={() => void handleWithdraw()}
                  loading={isWithdrawing}
                  disabled={isVoting || isWithdrawing}
                  loadingText="Wird zurückgezogen..."
                  className="btn-outline border-red-300 text-red-700 hover:bg-red-50"
                >
                  Stimme zurückziehen
                </LoadingButton>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
