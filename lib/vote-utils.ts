export const VOTE_OPTIONS = [
  { value: "JA" as const, label: "Ja", color: "bg-green-100 text-green-800 border-green-300" },
  { value: "NEIN" as const, label: "Nein", color: "bg-red-100 text-red-800 border-red-300" },
  { value: "VIELLEICHT" as const, label: "Vielleicht", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
] as const;

export type VoteOption = (typeof VOTE_OPTIONS)[number];
