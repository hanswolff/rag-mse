"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { canAccessAdminArea, canManageOwnProfile, canReadMemberDocuments } from "@/lib/role-utils";
import { API_ROUTES } from "@/lib/api-routes";
import { MenuIcon, XIcon } from "./icons";
import { ImpersonationBanner } from "./nav/impersonation-banner";
import { DesktopInfoMenu, MobileInfoMenu, INFO_ITEMS, MEMBER_DOCUMENTS_ITEM } from "./nav/info-menu";
import { DesktopUserMenu, MobileUserMenu } from "./nav/user-menu";

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
  "px-3 py-2 sm:py-2.5 rounded-md text-base font-semibold uppercase tracking-wide block transition-colors touch-manipulation";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isInfoMenuOpen, setIsInfoMenuOpen] = useState(false);
  const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false);
  const [isStoppingImpersonation, setIsStoppingImpersonation] = useState(false);
  const [impersonationError, setImpersonationError] = useState("");
  const [openPollsCount, setOpenPollsCount] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const infoMenuRef = useRef<HTMLDivElement>(null);
  const { data: session, status, update } = useSession();

  const isActive = (path: string) => pathname === path;

  const getLinkClasses = useCallback((path: string, isMobile = false) =>
    `${isMobile ? MOBILE_LINK_CLASSES : BASE_LINK_CLASSES} ${
      pathname === path ? ACTIVE_CLASSES : INACTIVE_CLASSES
    }`, [pathname]);

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

  useEffect(() => {
    if (!isMenuOpen) {
      setIsMobileInfoOpen(false);
    }
  }, [isMenuOpen]);

  const userName = session?.user?.name || "Benutzer";
  const canAccessSelfServiceMenu = !!session && canManageOwnProfile(session.user);
  const isImpersonating = !!session?.user?.isImpersonating && !!session.user.impersonatedBy?.id;
  const impersonatedBy = session?.user?.impersonatedBy;
  const showAdminLink = !!session && canAccessAdminArea(session.user);
  const showMemberDocuments = status === "authenticated" && !!session && canReadMemberDocuments(session.user);

  // Fetch open polls count for badge in user menu
  useEffect(() => {
    if (status !== "authenticated" || !canAccessSelfServiceMenu) return;

    let ignore = false;
    const fetchOpenPollsCount = async () => {
      try {
        const response = await fetch("/api/polls?status=LIVE&limit=50");
        if (!response.ok || ignore) return;
        const data = await response.json();
        // Count polls where user hasn't voted
        const count = data.polls.filter(
          (poll: { userVoteOptionIds: string[] }) => poll.userVoteOptionIds.length === 0
        ).length;
        if (!ignore) setOpenPollsCount(count);
      } catch {
        // Silently fail - badge is optional
      }
    };

    void fetchOpenPollsCount();

    // Listen for poll vote changes to refresh badge
    const handlePollVoteChanged = () => {
      void fetchOpenPollsCount();
    };

    window.addEventListener("poll-vote-changed", handlePollVoteChanged);
    return () => {
      ignore = true;
      window.removeEventListener("poll-vote-changed", handlePollVoteChanged);
    };
  }, [status, canAccessSelfServiceMenu]);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  const handleMobileLogout = async () => {
    setIsMenuOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  const handleStopImpersonation = async () => {
    if (!isImpersonating || isStoppingImpersonation) return;

    if (typeof update !== "function") {
      setImpersonationError("Impersonierung konnte nicht beendet werden");
      return;
    }

    setImpersonationError("");
    setIsStoppingImpersonation(true);
    try {
      const response = await fetch(API_ROUTES.AUTH.IMPERSONATION_STOP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || typeof data.proof !== "string") {
        setImpersonationError(data.error || "Impersonierung konnte nicht beendet werden");
        return;
      }

      const updatedSession = await update({ impersonationStopProof: data.proof });
      if (updatedSession?.user?.isImpersonating) {
        setImpersonationError("Impersonierung konnte nicht beendet werden");
        return;
      }

      router.push("/admin/benutzerverwaltung");
      router.refresh();
    } catch {
      setImpersonationError("Impersonierung konnte nicht beendet werden");
    } finally {
      setIsStoppingImpersonation(false);
    }
  };

  const isInfoActive = INFO_ITEMS.some((item) => isActive(item.href)) || isActive(MEMBER_DOCUMENTS_ITEM.href);
  const infoButtonClassName = `${BASE_LINK_CLASSES} ${isInfoActive ? ACTIVE_CLASSES : INACTIVE_CLASSES} flex items-center gap-1`;

  return (
    <nav className="bg-white text-brand-blue-900 shadow-sm sticky top-0 z-header border-b-4 border-brand-red-600">
      {isImpersonating && (
        <ImpersonationBanner
          userName={userName}
          impersonatedByName={impersonatedBy?.name}
          onStop={() => void handleStopImpersonation()}
          isStopping={isStoppingImpersonation}
          error={impersonationError}
        />
      )}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-20">
          <div className="flex items-center flex-shrink-0">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="relative w-9 h-9 sm:w-12 sm:h-12">
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

          <div className="hidden lg:block">
            <div className="ml-6 sm:ml-10 flex items-center space-x-2 sm:space-x-4">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className={getLinkClasses(item.href)}>
                  {item.label}
                </Link>
              ))}

              <DesktopInfoMenu
                isOpen={isInfoMenuOpen}
                onToggle={() => setIsInfoMenuOpen(!isInfoMenuOpen)}
                onItemClick={() => setIsInfoMenuOpen(false)}
                menuRef={infoMenuRef}
                buttonClassName={infoButtonClassName}
                showMemberDocuments={showMemberDocuments}
              />

              <Link href="/kontakt" className={getLinkClasses("/kontakt")}>
                Kontakt
              </Link>

              <DesktopUserMenu
                status={status}
                isOpen={isUserMenuOpen}
                onToggle={() => setIsUserMenuOpen(!isUserMenuOpen)}
                onItemClick={() => setIsUserMenuOpen(false)}
                onLogout={handleLogout}
                menuRef={userMenuRef}
                userName={userName}
                showAdminLink={showAdminLink}
                showSelfServiceMenu={canAccessSelfServiceMenu}
                openPollsCount={openPollsCount}
              />
            </div>
          </div>

          <div className="-mr-2 flex lg:hidden">
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

      <div className={`${isMenuOpen ? "block" : "hidden"} lg:hidden`} data-testid="mobile-menu">
        <div className="px-3 pt-1.5 pb-3 space-y-0.5 bg-white border-t border-brand-blue-100 max-h-[calc(100vh-3.5rem)] sm:max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain">
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

          <MobileInfoMenu
            isOpen={isMobileInfoOpen}
            onToggle={() => setIsMobileInfoOpen(!isMobileInfoOpen)}
            onItemClick={() => setIsMenuOpen(false)}
            showMemberDocuments={showMemberDocuments}
            getLinkClasses={getLinkClasses}
          />

          <Link
            href="/kontakt"
            className={getLinkClasses("/kontakt", true)}
            onClick={() => setIsMenuOpen(false)}
          >
            Kontakt
          </Link>

          <MobileUserMenu
            status={status}
            onItemClick={() => setIsMenuOpen(false)}
            onLogout={() => void handleMobileLogout()}
            userName={userName}
            showAdminLink={showAdminLink}
            showSelfServiceMenu={canAccessSelfServiceMenu}
            getLinkClasses={getLinkClasses}
            openPollsCount={openPollsCount}
          />
        </div>
      </div>
    </nav>
  );
}
