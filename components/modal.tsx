"use client";

import { useEffect, useRef, useState } from "react";

export const DEFAULT_MODAL_MAX_HEIGHT = "90vh";

const ANIMATION_DELAY_MS = 10;
const FOCUS_DELAY_MS = 100;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  maxHeight?: string;
  contentOverflow?: "auto" | "visible";
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-3xl",
  "3xl": "max-w-4xl",
  "4xl": "max-w-7xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "lg",
  maxHeight = DEFAULT_MODAL_MAX_HEIGHT,
  contentOverflow = "auto",
  closeOnOutsideClick = true,
  closeOnEscape = true
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const isElementVisible = (element: HTMLElement): boolean => {
    const style = window.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      element.offsetParent !== null
    );
  };

  const isElementEnabled = (element: HTMLElement): boolean => {
    return !("disabled" in element) || !(element as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled;
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) {
        onCloseRef.current();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && closeOnOutsideClick) {
        onCloseRef.current();
      }
    };

    const getVisibleFocusableElements = (): HTMLElement[] => {
      if (!modalRef.current) return [];

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;

      return Array.from(focusableElements).filter((element) => isElementVisible(element) && isElementEnabled(element));
    };

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusableElements = getVisibleFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    if (isOpen) {
      const animationTimer = setTimeout(() => setIsAnimating(true), ANIMATION_DELAY_MS);
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";

      document.addEventListener("keydown", handleEscape);
      document.addEventListener("keydown", handleTab);
      document.addEventListener("mousedown", handleClickOutside);

      const focusTimer = setTimeout(() => {
        const focusableElements = getVisibleFocusableElements();
        if (focusableElements.length === 0) return;
        if (modalRef.current && modalRef.current.contains(document.activeElement)) return;
        focusableElements[0]?.focus();
      }, FOCUS_DELAY_MS);

      return () => {
        clearTimeout(animationTimer);
        clearTimeout(focusTimer);
        document.removeEventListener("keydown", handleEscape);
        document.removeEventListener("keydown", handleTab);
        document.removeEventListener("mousedown", handleClickOutside);
        document.body.style.overflow = "";
        setIsAnimating(false);
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, closeOnEscape, closeOnOutsideClick]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-modal flex items-center justify-center p-4 transition-opacity duration-200 ${
        isAnimating ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity duration-200 ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        className={`relative bg-white rounded-lg shadow-xl w-full flex flex-col transition-all duration-200 ${
          sizeClasses[size]
        } ${isAnimating ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        style={{ maxHeight }}
      >
        <div className="flex items-center justify-between gap-3 p-3 sm:p-4 border-b border-gray-200 shrink-0">
          <h2 id="modal-title" className="min-w-0 flex-1 text-lg sm:text-xl font-semibold text-gray-900 break-words">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-red-600/30 rounded-md p-1 transition-colors"
            aria-label="Schließen"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className={`p-4 sm:p-6 ${contentOverflow === "visible" ? "overflow-visible" : "overflow-y-auto"}`}>{children}</div>
      </div>
    </div>
  );
}
