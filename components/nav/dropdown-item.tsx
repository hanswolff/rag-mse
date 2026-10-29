"use client";

import type { ReactNode } from "react";
import Link from "next/link";

const ITEM_CLASSES = "px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors";

interface DropdownItemProps {
  // Ohne href wird ein Button gerendert (z. B. Ausloggen).
  href?: string;
  onClick: () => void;
  // "flex" für Einträge mit Badge rechts, sonst "block".
  layout?: "block" | "flex";
  children: ReactNode;
}

export function DropdownItem({ href, onClick, layout = "block", children }: DropdownItemProps) {
  if (href === undefined) {
    return (
      <button type="button" onClick={onClick} className={`block w-full text-left ${ITEM_CLASSES}`}>
        {children}
      </button>
    );
  }

  const className = `${layout === "flex" ? "flex items-center justify-between" : "block"} ${ITEM_CLASSES}`;
  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
