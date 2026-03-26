"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { UserIcon } from "../icons";

interface DesktopUserMenuProps {
  status: "loading" | "authenticated" | "unauthenticated";
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: () => void;
  onLogout: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
  userName: string;
  showAdminLink: boolean;
  showSelfServiceMenu: boolean;
  openPollsCount?: number;
}

export function DesktopUserMenu({
  status,
  isOpen,
  onToggle,
  onItemClick,
  onLogout,
  menuRef,
  userName,
  showAdminLink,
  showSelfServiceMenu,
  openPollsCount = 0,
}: DesktopUserMenuProps) {
  if (status === "loading") return null;

  if (status !== "authenticated") {
    return (
      <Link href="/login" className="btn-primary text-base px-4 py-2">
        Einloggen
      </Link>
    );
  }

  return (
    <div className="relative ml-2 sm:ml-4" ref={menuRef}>
      <button
        type="button"
        className="btn-outline flex items-center gap-2 px-3 sm:px-4 py-2 text-base"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <UserIcon className="w-4 h-4" />
        <span className="hidden lg:inline">{userName}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-auto min-w-[15rem] bg-white rounded-md shadow-lg py-1 z-dropdown border border-gray-200">
          {showAdminLink && (
            <>
              <Link
                href="/admin"
                onClick={onItemClick}
                className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Adminbereich
              </Link>
              <div className="border-t border-gray-200 my-1" />
            </>
          )}
          {showSelfServiceMenu && (
            <>
              <Link
                href="/profil"
                onClick={onItemClick}
                className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Profil
              </Link>
              <Link
                href="/passwort-aendern"
                onClick={onItemClick}
                className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Passwort ändern
              </Link>
              <div className="border-t border-gray-200 my-1" />
              <Link
                href="/umfragen"
                onClick={onItemClick}
                className="flex items-center justify-between px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Umfragen
                {openPollsCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-red-600 text-white">
                    {openPollsCount}
                  </span>
                )}
              </Link>
              <Link
                href="/benachrichtigungen"
                onClick={onItemClick}
                className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Benachrichtigungen
              </Link>
            </>
          )}
          <div className="border-t border-gray-200 my-1" />
          <button
            type="button"
            onClick={onLogout}
            className="block w-full text-left px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Abmelden
          </button>
        </div>
      )}
    </div>
  );
}

interface MobileUserMenuProps {
  status: "loading" | "authenticated" | "unauthenticated";
  onItemClick: () => void;
  onLogout: () => void;
  userName: string;
  showAdminLink: boolean;
  showSelfServiceMenu: boolean;
  getLinkClasses: (path: string, isMobile?: boolean) => string;
  openPollsCount?: number;
}

export function MobileUserMenu({
  status,
  onItemClick,
  onLogout,
  userName,
  showAdminLink,
  showSelfServiceMenu,
  getLinkClasses,
  openPollsCount = 0,
}: MobileUserMenuProps) {
  if (status === "loading") return null;

  if (status !== "authenticated") {
    return (
      <Link href="/login" className="btn-primary w-full text-center" onClick={onItemClick}>
        Einloggen
      </Link>
    );
  }

  return (
    <>
      <div className="border-t border-brand-blue-100 pt-2 mt-2">
        <div className="px-3 py-1.5 text-base text-brand-blue-700 flex items-center gap-2">
          <UserIcon className="w-4 h-4" />
          {userName}
        </div>
      </div>
      {showAdminLink && (
        <>
          <Link
            href="/admin"
            className={`${getLinkClasses("/admin", true)} flex items-center gap-2`}
            onClick={onItemClick}
          >
            Adminbereich
          </Link>
          <div className="border-t border-brand-blue-100 my-1" />
        </>
      )}
      {showSelfServiceMenu && (
        <>
          <Link
            href="/profil"
            className={`${getLinkClasses("/profil", true)} flex items-center gap-2`}
            onClick={onItemClick}
          >
            Profil
          </Link>
          <Link
            href="/passwort-aendern"
            className={`${getLinkClasses("/passwort-aendern", true)} flex items-center gap-2`}
            onClick={onItemClick}
          >
            Passwort ändern
          </Link>
          <div className="border-t border-brand-blue-100 my-1" />
          <Link
            href="/umfragen"
            className={`${getLinkClasses("/umfragen", true)} flex items-center justify-between`}
            onClick={onItemClick}
          >
            Umfragen
            {openPollsCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-red-600 text-white">
                {openPollsCount}
              </span>
            )}
          </Link>
          <Link
            href="/benachrichtigungen"
            className={`${getLinkClasses("/benachrichtigungen", true)} flex items-center gap-2`}
            onClick={onItemClick}
          >
            Benachrichtigungen
          </Link>
        </>
      )}
      <div className="border-t border-brand-blue-100 my-1" />
      <button
        type="button"
        onClick={onLogout}
        className="w-full text-left px-3 py-2 rounded-md text-base font-semibold uppercase tracking-wide text-brand-blue-900 hover:bg-brand-blue-50 hover:text-brand-red-700 transition-colors touch-manipulation"
      >
        Abmelden
      </button>
    </>
  );
}
