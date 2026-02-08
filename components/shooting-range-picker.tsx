"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "./modal";

const COMPACT_MODAL_MAX_HEIGHT = "67.5vh";

export interface ShootingRange {
  id: string;
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
}

interface ShootingRangePickerProps {
  disabled?: boolean;
  onSelect: (range: ShootingRange, locationLabel: string) => void;
}

function formatRangeLabel(range: ShootingRange): string {
  const locationParts = [range.city].filter(Boolean);
  if (locationParts.length === 0) return range.name;
  return `${range.name}, ${locationParts.join(" ")}`;
}

function formatRangeAddress(range: ShootingRange): string {
  const line1 = range.street ? range.street : "";
  const line2 = [range.postalCode, range.city].filter(Boolean).join(" ").trim();
  if (line1 && line2) return `${line1} · ${line2}`;
  return line1 || line2 || "";
}

export function ShootingRangePicker({ disabled, onSelect }: ShootingRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ranges, setRanges] = useState<ShootingRange[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || isLoading) return;
    let isMounted = true;

    async function loadRanges() {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch("/api/ranges");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Schießstände konnten nicht geladen werden");
        }
        if (isMounted) {
          setRanges(data.ranges || []);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRanges();
    return () => {
      isMounted = false;
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) {
      setRanges([]);
      setError("");
    }
  }, [isOpen]);

  const sortedRanges = useMemo(() => {
    return [...ranges].sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [ranges]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-brand-blue-600 text-white rounded-md hover:bg-brand-blue-700 focus:outline-none focus:ring-2 focus:ring-brand-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-base sm:text-base touch-manipulation"
      >
        Schießstand auswählen
      </button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Schießstand auswählen"
        size="lg"
        maxHeight={COMPACT_MODAL_MAX_HEIGHT}
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {isLoading && <p className="text-gray-600">Schießstände werden geladen...</p>}
          {!isLoading && !error && sortedRanges.length === 0 && (
            <p className="text-gray-500">Keine Schießstände verfügbar.</p>
          )}
          {!isLoading && !error && sortedRanges.length > 0 && (
            <div className="space-y-3">
              {sortedRanges.map((range) => (
                <button
                  key={range.id}
                  type="button"
                  onClick={() => {
                    onSelect(range, formatRangeLabel(range));
                    setIsOpen(false);
                  }}
                  className="w-full text-left border border-gray-200 rounded-md px-4 py-3 hover:border-brand-blue-400 hover:bg-brand-blue-50 focus:outline-none focus:ring-2 focus:ring-brand-blue-500 transition"
                >
                  <div className="text-base font-semibold text-gray-900">{range.name}</div>
                  {formatRangeAddress(range) && (
                    <div className="text-base text-gray-600 mt-1">{formatRangeAddress(range)}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
