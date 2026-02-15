"use client";

import { getPasswordRequirementsWithStatus } from "@/lib/password-validation";

interface PasswordRequirementsProps {
  password: string;
  className?: string;
}

export function PasswordRequirements({ password, className = "" }: PasswordRequirementsProps) {
  const requirements = getPasswordRequirementsWithStatus(password);
  const allMet = requirements.every((req) => req.met);
  const metCount = requirements.filter((req) => req.met).length;

  return (
    <div className={className}>
      <ul
        role="list"
        aria-label="Passwort-Anforderungen"
        className="mt-2 space-y-1 text-base"
      >
        {requirements.map((req) => (
          <li
            key={req.label}
            className={`flex items-center gap-2 ${
              req.met ? "text-green-600" : "text-gray-400"
            }`}
          >
            <span className="flex-shrink-0" aria-hidden="true">
              {req.met ? "✓" : "○"}
            </span>
            <span>{req.label}</span>
            <span className="sr-only">
              {req.met ? "erfüllt" : "nicht erfüllt"}
            </span>
          </li>
        ))}
      </ul>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {allMet
          ? "Alle Passwort-Anforderungen erfüllt"
          : `${metCount} von ${requirements.length} Anforderungen erfüllt`}
      </div>
    </div>
  );
}
