"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "../icons";
import { MenuBadge } from "./menu-badge";

export const AUSSCHREIBUNGEN_HREF = "/ausschreibungen";

// Beschriftung für Screenreader: das Badge zeigt nur die nackte Zahl.
const AUSSCHREIBUNGEN_BADGE_LABEL = "offene Ausschreibungen";

export const TOP_INFO_ITEMS = [
  { href: AUSSCHREIBUNGEN_HREF, label: "Ausschreibungen" },
  { href: "/info/formulare", label: "Formulare" },
] as const;

export const INFO_ITEMS = [
  { href: "/info/schiesssportordnung", label: "Schießsportordnung" },
  { href: "/info/leitfaden-waffenteile", label: "Leitfaden Waffenteile" },
  { href: "/info/waffentechnische-begriffe", label: "Waffentechnische Begriffe" },
  { href: "/info/sachkundepruefung", label: "Sachkundeprüfung" },
  { href: "/info/sicherheitsbelehrung", label: "Sicherheitsbelehrung" },
] as const;

export const MEMBER_DOCUMENTS_ITEM = { href: "/mitglieder-dokumente", label: "Dokumente für Mitglieder" };

interface DesktopInfoMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
  buttonClassName: string;
  showMemberDocuments: boolean;
  openAusschreibungenCount?: number;
}

export function DesktopInfoMenu({
  isOpen,
  onToggle,
  onItemClick,
  menuRef,
  buttonClassName,
  showMemberDocuments,
  openAusschreibungenCount = 0,
}: DesktopInfoMenuProps) {
  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={buttonClassName}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span>Infos</span>
        <MenuBadge count={openAusschreibungenCount} label={AUSSCHREIBUNGEN_BADGE_LABEL} />
        <ChevronDownIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-auto min-w-[15rem] bg-white rounded-md shadow-lg py-1 z-dropdown border border-gray-200">
          {TOP_INFO_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className="flex items-center justify-between px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span>{item.label}</span>
              {item.href === AUSSCHREIBUNGEN_HREF && (
                <MenuBadge count={openAusschreibungenCount} label={AUSSCHREIBUNGEN_BADGE_LABEL} />
              )}
            </Link>
          ))}
          {showMemberDocuments && (
            <Link
              href={MEMBER_DOCUMENTS_ITEM.href}
              onClick={onItemClick}
              className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {MEMBER_DOCUMENTS_ITEM.label}
            </Link>
          )}
          <div className="border-t border-gray-200 my-1" />
          {INFO_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

interface MobileInfoMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: () => void;
  showMemberDocuments: boolean;
  getLinkClasses: (path: string, isMobile?: boolean) => string;
  openAusschreibungenCount?: number;
}

export function MobileInfoMenu({
  isOpen,
  onToggle,
  onItemClick,
  showMemberDocuments,
  getLinkClasses,
  openAusschreibungenCount = 0,
}: MobileInfoMenuProps) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 rounded-md text-base font-semibold uppercase tracking-wide text-brand-blue-700 hover:bg-brand-blue-50 transition-colors touch-manipulation"
        aria-expanded={isOpen}
      >
        <span className="flex items-center">
          <span>Infos</span>
          <MenuBadge count={openAusschreibungenCount} label={AUSSCHREIBUNGEN_BADGE_LABEL} />
        </span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="space-y-1">
          {TOP_INFO_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${getLinkClasses(item.href, true)} pl-6 flex items-center justify-between`}
              onClick={onItemClick}
            >
              <span>{item.label}</span>
              {item.href === AUSSCHREIBUNGEN_HREF && (
                <MenuBadge count={openAusschreibungenCount} label={AUSSCHREIBUNGEN_BADGE_LABEL} />
              )}
            </Link>
          ))}
          {showMemberDocuments && (
            <Link
              href={MEMBER_DOCUMENTS_ITEM.href}
              className={`${getLinkClasses(MEMBER_DOCUMENTS_ITEM.href, true)} pl-6`}
              onClick={onItemClick}
            >
              {MEMBER_DOCUMENTS_ITEM.label}
            </Link>
          )}
          <div className="border-t border-gray-200 my-1" />
          {INFO_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${getLinkClasses(item.href, true)} pl-6`}
              onClick={onItemClick}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
