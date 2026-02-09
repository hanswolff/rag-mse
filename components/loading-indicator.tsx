"use client";

interface LoadingIndicatorProps {
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses: Record<NonNullable<LoadingIndicatorProps["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
};

export function LoadingIndicator({ size = "sm", className = "" }: LoadingIndicatorProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-current border-t-transparent ${sizeClasses[size]} ${className}`.trim()}
    />
  );
}
