"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { LuCheck, LuCopy, LuLink2 } from "react-icons/lu";

interface CopyLinkButtonProps {
  url: string;
  label?: string;
  className?: string;
  compact?: boolean;
}

export function CopyLinkButton({ url, label, className = "", compact = false }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [url]);

  const containerClassName = compact
    ? `inline-flex max-w-full items-center gap-2 align-middle ${className}`
    : `flex items-center gap-2 ${className}`;
  const linkBoxClassName = compact
    ? "inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-brand-red-200 bg-brand-red-50 px-2.5 py-1 text-sm text-brand-red-900"
    : "flex min-w-0 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700";
  const buttonClassName = compact
    ? `btn-icon h-8 w-8 shrink-0 ${copied ? "!border-green-300 !bg-green-50 !text-green-700" : ""}`
    : `btn-icon shrink-0 ${copied ? "!border-green-300 !bg-green-50 !text-green-700" : ""}`;

  return (
    <div className={containerClassName}>
      <div className={linkBoxClassName}>
        <LuLink2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-all">{label ? `${label}: ${url}` : url}</span>
      </div>
      <button
        type="button"
        onClick={(e) => void handleCopy(e)}
        className={buttonClassName}
        title={copied ? "Kopiert!" : "Kurzlink kopieren"}
        aria-label={copied ? "Kurzlink kopiert" : `Kurzlink kopieren: ${url}`}
      >
        {copied ? <LuCheck className="h-4 w-4" aria-hidden="true" /> : <LuCopy className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
