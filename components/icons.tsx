import { memo } from "react";
import { PiTargetBold } from "react-icons/pi";

interface IconProps {
  className?: string;
}

interface CreateIconOptions {
  viewBox?: string;
  strokeWidth?: number;
}

function createIcon(name: string, paths: string | string[], options: CreateIconOptions = {}) {
  const { viewBox = "0 0 24 24", strokeWidth = 2 } = options;
  const pathList = Array.isArray(paths) ? paths : [paths];

  const Icon = memo(function Icon({ className = "" }: IconProps) {
    return (
      <svg
        className={className}
        fill="none"
        viewBox={viewBox}
        stroke="currentColor"
        aria-hidden="true"
      >
        {pathList.map((d) => (
          <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d={d} />
        ))}
      </svg>
    );
  });
  Icon.displayName = name;
  return Icon;
}

export const CalendarIcon = createIcon(
  "CalendarIcon",
  "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
);

export const NewsIcon = createIcon(
  "NewsIcon",
  "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
);

export const MailIcon = createIcon(
  "MailIcon",
  "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
);

export const MenuIcon = createIcon("MenuIcon", "M4 6h16M4 12h16M4 18h16");

export const XIcon = createIcon("XIcon", "M6 18L18 6M6 6l12 12");

export const UserIcon = createIcon(
  "UserIcon",
  "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
);

export const ExternalLinkIcon = createIcon(
  "ExternalLinkIcon",
  "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
);

export const ChevronDownIcon = createIcon("ChevronDownIcon", "M19 9l-7 7-7-7");

export const FileDocumentIcon = createIcon(
  "FileDocumentIcon",
  "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
);

export const DownloadDocumentIcon = createIcon(
  "DownloadDocumentIcon",
  "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
);

export const ArrowLeftIcon = createIcon("ArrowLeftIcon", "M10 19l-7-7m0 0l7-7m-7 7h18");

export const PlusIcon = createIcon("PlusIcon", "M10 4.5v11m-5.5-5.5h11", {
  viewBox: "0 0 20 20",
  strokeWidth: 1.8,
});

export const UsersIcon = createIcon(
  "UsersIcon",
  "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
);

export const FolderIcon = createIcon(
  "FolderIcon",
  "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
);

export const FileIcon = createIcon(
  "FileIcon",
  "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
);

export const PencilIcon = createIcon(
  "PencilIcon",
  "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
);

export const TrashIcon = createIcon(
  "TrashIcon",
  "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
);

export const ArrowUpIcon = createIcon("ArrowUpIcon", "M5 10l7-7m0 0l7 7m-7-7v18");

export const EyeIcon = createIcon("EyeIcon", [
  "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
]);

export const EyeOffIcon = createIcon(
  "EyeOffIcon",
  "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
);

export const DownloadIcon = createIcon(
  "DownloadIcon",
  "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
);

export const CloseSmallIcon = createIcon("CloseSmallIcon", "M5.5 5.5l9 9m0-9l-9 9", {
  viewBox: "0 0 20 20",
  strokeWidth: 1.8,
});

export const TargetIcon = memo(function TargetIcon({ className = "" }: IconProps) {
  return (
    <PiTargetBold className={className} aria-hidden="true" focusable="false" />
  );
});
