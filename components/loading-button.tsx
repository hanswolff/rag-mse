"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoadingIndicator } from "./loading-indicator";

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading: boolean;
  loadingText?: ReactNode;
}

export function LoadingButton({
  loading,
  loadingText,
  disabled,
  children,
  className,
  ...buttonProps
}: LoadingButtonProps) {
  return (
    <button
      {...buttonProps}
      disabled={disabled || loading}
      aria-busy={loading}
      className={className}
    >
      {loading ? (
        <>
          <LoadingIndicator />
          {loadingText ?? children}
        </>
      ) : children}
    </button>
  );
}
