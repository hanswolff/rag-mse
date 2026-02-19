"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { isAdmin } from "@/lib/role-utils";
import { MenuIcon, XIcon, UserIcon, ChevronDownIcon } from "./icons";

const NAV_ITEMS = [
  { href: "/", label: "Startseite" },
  { href: "/ueber-uns", label: "Über uns" },
  { href: "/termine", label: "Termine" },
] as const;

const ACTIVE_CLASSES = "text-brand-red-700 border-brand-red-600";
const INACTIVE_CLASSES = "text-brand-blue-900 hover:text-brand-red-700 border-transparent";
const BASE_LINK_CLASSES =
  "px-2 sm:px-3 py-2 font-semibold uppercase tracking-wide text-base sm:text-base border-b-2 transition-colors touch-manipulation";

const MOBILE_LINK_CLASSES =
  "px-3 py-3 sm:px-4 sm:py-2 rounded-md text-base font-semibold uppercase tracking-wide block transition-colors touch-manipulation";

export function Navigation() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isInfoMenuOpen, setIsInfoMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const infoMenuRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();

  const isActive = (path: string) => pathname === path;

  const getLinkClasses = (path: string, isMobile = false) =>
    `${isMobile ? MOBILE_LINK_CLASSES : BASE_LINK_CLASSES} ${
      isActive(path) ? ACTIVE_CLASSES : INACTIVE_CLASSES
    }`;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (infoMenuRef.current && !infoMenuRef.current.contains(event.target as Node)) {
        setIsInfoMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userName = session?.user?.name || "Benutzer";

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  const handleUserMenuItemClick = () => {
    setIsUserMenuOpen(false);
  };

  const handleInfoMenuItemClick = () => {
    setIsInfoMenuOpen(false);
  };

  return (
    <nav className="bg-white text-brand-blue-900 shadow-sm sticky top-0 z-header border-b-4 border-brand-red-600">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <div className="flex items-center flex-shrink-0">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12">
                <Image
                  src="/vdrbw-logo.svg"
                  alt="RAG Schießsport Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-base sm:text-lg font-bold leading-tight text-brand-blue-900 truncate max-w-[11rem] sm:max-w-none">
                RAG Schießsport MSE
              </span>
            </Link>
          </div>

          <div className="hidden md:block">
            <div className="ml-6 sm:ml-10 flex items-center space-x-2 sm:space-x-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={getLinkClasses(item.href)}
                >
                  {item.label}
                </Link>
              ))}

              <div className="relative" ref={infoMenuRef}>
                <button
                  type="button"
                  className={`${BASE_LINK_CLASSES} ${isActive("/info/schiesssportordnung") || isActive("/info/formulare") || isActive("/info/leitfaden-waffenteile") || isActive("/info/sicherheitsbelehrung") ? ACTIVE_CLASSES : INACTIVE_CLASSES} flex items-center gap-1`}
                  onClick={() => setIsInfoMenuOpen(!isInfoMenuOpen)}
                  aria-expanded={isInfoMenuOpen}
                  aria-haspopup="true"
                >
                  Infos
                  <ChevronDownIcon className="w-4 h-4" />
                </button>

                {isInfoMenuOpen && (
                  <div className="absolute left-0 mt-2 w-auto min-w-[15rem] bg-white rounded-md shadow-lg py-1 z-dropdown border border-gray-200">
                    <Link
                      href="/info/schiesssportordnung"
                      onClick={handleInfoMenuItemClick}
                      className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Schießsportordnung
                    </Link>
                    <Link
                      href="/info/leitfaden-waffenteile"
                      onClick={handleInfoMenuItemClick}
                      className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Leitfaden Waffenteile
                    </Link>
                    <Link
                      href="/info/sicherheitsbelehrung"
                      onClick={handleInfoMenuItemClick}
                      className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Sicherheitsbelehrung
                    </Link>
                    <Link
                      href="/info/formulare"
                      onClick={handleInfoMenuItemClick}
                      className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Formulare
                    </Link>
                  </div>
                )}
              </div>

              <Link
                href="/kontakt"
                className={getLinkClasses("/kontakt")}
              >
                Kontakt
              </Link>

              {status === "loading" ? null : session ? (
                <div className="relative ml-2 sm:ml-4" ref={userMenuRef}>
                  <button
                    type="button"
                    className={`btn-outline flex items-center gap-2 px-3 sm:px-4 py-2 text-base`}
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="true"
                  >
                    <UserIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">{userName}</span>
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-auto min-w-[15rem] bg-white rounded-md shadow-lg py-1 z-dropdown border border-gray-200">
                      {isAdmin(session.user) && (
                        <>
                          <Link
                            href="/admin"
                            onClick={handleUserMenuItemClick}
                            className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            Adminbereich
                          </Link>
                          <div className="border-t border-gray-200 my-1" />
                        </>
                      )}
                      <Link
                        href="/profil"
                        onClick={handleUserMenuItemClick}
                        className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Profil
                      </Link>
                      <Link
                        href="/benachrichtigungen"
                        onClick={handleUserMenuItemClick}
                        className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Benachrichtigungen
                      </Link>
                      <Link
                        href="/passwort-aendern"
                        onClick={handleUserMenuItemClick}
                        className="block px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Passwort ändern
                      </Link>
                      <div className="border-t border-gray-200 my-1" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-base text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Abmelden
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="btn-primary text-base px-4 py-2"
                >
                  Einloggen
                </Link>
              )}
            </div>
          </div>

          <div className="-mr-2 flex md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-brand-blue-900 hover:text-brand-red-700 hover:bg-brand-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-brand-red-600/30 touch-manipulation"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">Menü öffnen</span>
              <span className={`${isMenuOpen ? "hidden" : "block"} h-6 w-6`}>
                <MenuIcon />
              </span>
              <span className={`${isMenuOpen ? "block" : "hidden"} h-6 w-6`}>
                <XIcon />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className={`${isMenuOpen ? "block" : "hidden"} md:hidden`} data-testid="mobile-menu">
        <div className="px-3 pt-2 pb-4 space-y-1 bg-white border-t border-brand-blue-100">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={getLinkClasses(item.href, true)}
              onClick={() => setIsMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}

          <div className="px-3 py-2 text-brand-blue-700 font-semibold uppercase tracking-wide">
            Infos
          </div>
          <Link
            href="/info/schiesssportordnung"
            className={`${getLinkClasses("/info/schiesssportordnung", true)} pl-6`}
            onClick={() => setIsMenuOpen(false)}
          >
            Schießsportordnung
          </Link>
          <Link
            href="/info/leitfaden-waffenteile"
            className={`${getLinkClasses("/info/leitfaden-waffenteile", true)} pl-6`}
            onClick={() => setIsMenuOpen(false)}
          >
            Leitfaden Waffenteile
          </Link>
          <Link
            href="/info/sicherheitsbelehrung"
            className={`${getLinkClasses("/info/sicherheitsbelehrung", true)} pl-6`}
            onClick={() => setIsMenuOpen(false)}
          >
            Sicherheitsbelehrung
          </Link>
          <Link
            href="/info/formulare"
            className={`${getLinkClasses("/info/formulare", true)} pl-6`}
            onClick={() => setIsMenuOpen(false)}
          >
            Formulare
          </Link>

          <Link
            href="/kontakt"
            className={getLinkClasses("/kontakt", true)}
            onClick={() => setIsMenuOpen(false)}
          >
            Kontakt
          </Link>

          {status === "loading" ? null : session ? (
            <>
              <div className="border-t border-brand-blue-100 pt-3 mt-3">
                <div className="px-3 py-2 text-base text-brand-blue-700 flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  {userName}
                </div>
              </div>
              {isAdmin(session.user) && (
                <>
                  <Link
                    href="/admin"
                    className={`${getLinkClasses("/admin", true)} flex items-center gap-2`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Adminbereich
                  </Link>
                  <div className="border-t border-brand-blue-100 my-2" />
                </>
              )}
              <Link
                href="/profil"
                className={`${getLinkClasses("/profil", true)} flex items-center gap-2`}
                onClick={() => setIsMenuOpen(false)}
              >
                Profil
              </Link>
              <Link
                href="/benachrichtigungen"
                className={`${getLinkClasses("/benachrichtigungen", true)} flex items-center gap-2`}
                onClick={() => setIsMenuOpen(false)}
              >
                Benachrichtigungen
              </Link>
              <Link
                href="/passwort-aendern"
                className={`${getLinkClasses("/passwort-aendern", true)} flex items-center gap-2`}
                onClick={() => setIsMenuOpen(false)}
              >
                Passwort ändern
              </Link>
              <div className="border-t border-brand-blue-100 my-2" />
              <button
                type="button"
                onClick={async () => {
                  setIsMenuOpen(false);
                  await signOut({ callbackUrl: "/" });
                }}
                className="w-full text-left px-3 py-3 rounded-md text-base font-semibold uppercase tracking-wide text-brand-blue-900 hover:bg-brand-blue-50 hover:text-brand-red-700 transition-colors touch-manipulation"
              >
                Abmelden
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="btn-primary w-full text-center"
              onClick={() => setIsMenuOpen(false)}
            >
              Einloggen
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
