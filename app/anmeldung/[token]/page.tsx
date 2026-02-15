"use client";

import { use, useEffect, useState } from "react";
import { VoteType } from "@prisma/client";
import { LoadingButton } from "@/components/loading-button";
import { VOTE_OPTIONS } from "@/lib/vote-utils";
import { formatDate, formatTime, isEventInPast } from "@/lib/date-utils";

interface RsvpEvent {
  id: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  location: string;
  description: string;
}

interface RsvpData {
  event: RsvpEvent;
  user: {
    name: string | null;
  };
  currentVote: {
    id: string;
    vote: VoteType;
  } | null;
}

export default function TokenRsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<RsvpData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [pendingVote, setPendingVote] = useState<VoteType | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchRsvp = async () => {
      setIsLoading(true);
      setError("");
      setSuccess("");

      try {
        const response = await fetch(`/api/notifications/rsvp/${token}`);
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "Link ist ungültig oder abgelaufen");
        }

        setData(json);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Ein Fehler ist aufgetreten");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchRsvp();
  }, [token]);

  async function handleVote(vote: VoteType) {
    setIsVoting(true);
    setPendingVote(vote);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/notifications/rsvp/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vote }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Fehler bei der Teilnahmeanmeldung");
      }

      setData((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          currentVote: {
            id: json.id,
            vote: json.vote,
          },
        };
      });
      setSuccess("Deine Teilnahme wurde gespeichert");
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsVoting(false);
      setPendingVote(null);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="card text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Terminanmeldung</h1>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  const isPast = isEventInPast(data.event.date);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <article className="card">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Terminanmeldung</h1>
          <p className="text-gray-600 mb-4">
            Hallo {data.user.name?.trim() || "Mitglied"}, bitte wähle deine Teilnahme für diesen Termin.
          </p>

          <div className="space-y-2 text-gray-800">
            <p>
              <span className="font-semibold">Datum:</span> {formatDate(data.event.date)}
            </p>
            <p>
              <span className="font-semibold">Uhrzeit:</span> {formatTime(data.event.timeFrom)} - {formatTime(data.event.timeTo)}
            </p>
            <p>
              <span className="font-semibold">Ort:</span> {data.event.location}
            </p>
          </div>
        </article>

        <section className="card">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}

          {isPast ? (
            <p className="text-blue-700">
              Dieser Termin ist bereits vorbei. Teilnahmeanmeldungen sind nicht mehr möglich.
            </p>
          ) : (
            <>
              <p className="text-gray-700 mb-4">
                {data.currentVote ? `Deine aktuelle Auswahl: ${VOTE_OPTIONS.find((o) => o.value === data.currentVote?.vote)?.label}` : "Bitte wählen:"}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {VOTE_OPTIONS.map((option) => (
                  <LoadingButton
                    key={option.value}
                    onClick={() => handleVote(option.value)}
                    loading={isVoting && pendingVote === option.value}
                    loadingText={option.label}
                    className={`px-4 py-3 rounded-lg font-medium border-2 transition-all ${
                      data.currentVote?.vote === option.value
                        ? `${option.color} border-current`
                        : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    {option.label}
                  </LoadingButton>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
