import { memo } from "react";

interface IllustrationProps {
  className?: string;
}

export const EmptyCalendarIllustration = memo(function EmptyCalendarIllustration({
  className = "",
}: IllustrationProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="20"
        y="30"
        width="80"
        height="70"
        rx="8"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <rect
        x="20"
        y="30"
        width="80"
        height="18"
        rx="8"
        fill="currentColor"
        opacity="0.08"
      />
      <line
        x1="38"
        y1="24"
        x2="38"
        y2="36"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <line
        x1="82"
        y1="24"
        x2="82"
        y2="36"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <circle cx="42" cy="62" r="3" fill="currentColor" opacity="0.15" />
      <circle cx="60" cy="62" r="3" fill="currentColor" opacity="0.15" />
      <circle cx="78" cy="62" r="3" fill="currentColor" opacity="0.15" />
      <circle cx="42" cy="80" r="3" fill="currentColor" opacity="0.1" />
      <circle cx="60" cy="80" r="3" fill="currentColor" opacity="0.1" />
      <path
        d="M50 90 L60 100 L80 75"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.2"
      />
    </svg>
  );
});

export const EmptyNewsIllustration = memo(function EmptyNewsIllustration({
  className = "",
}: IllustrationProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="15"
        y="20"
        width="70"
        height="85"
        rx="6"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <rect
        x="35"
        y="25"
        width="70"
        height="85"
        rx="6"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.15"
        fill="currentColor"
        fillOpacity="0.03"
      />
      <rect
        x="25"
        y="35"
        width="40"
        height="4"
        rx="2"
        fill="currentColor"
        opacity="0.15"
      />
      <rect
        x="25"
        y="45"
        width="50"
        height="3"
        rx="1.5"
        fill="currentColor"
        opacity="0.1"
      />
      <rect
        x="25"
        y="53"
        width="45"
        height="3"
        rx="1.5"
        fill="currentColor"
        opacity="0.1"
      />
      <rect
        x="25"
        y="61"
        width="35"
        height="3"
        rx="1.5"
        fill="currentColor"
        opacity="0.08"
      />
      <rect
        x="25"
        y="75"
        width="30"
        height="4"
        rx="2"
        fill="currentColor"
        opacity="0.12"
      />
      <rect
        x="25"
        y="85"
        width="50"
        height="3"
        rx="1.5"
        fill="currentColor"
        opacity="0.08"
      />
      <rect
        x="25"
        y="93"
        width="40"
        height="3"
        rx="1.5"
        fill="currentColor"
        opacity="0.08"
      />
    </svg>
  );
});
