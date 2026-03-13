"use client";

import { DragEvent, MouseEvent, ReactNode } from "react";
import { SearchHighlight } from "@/components/search-highlight";
import { DownloadIcon, EyeIcon, EyeOffIcon, FolderIcon, FileIcon } from "@/components/icons";
import { formatFileSize, formatDateTime, formatDateUtc, isViewableDocument, type DocumentSortField, type DocumentSortDirection } from "@/lib/document-utils";
import type { DocumentItem, DocumentDirectoryItem } from "@/types";

export type { DocumentSortField, DocumentSortDirection };

function getSortIndicator(currentField: DocumentSortField, sortBy: DocumentSortField, sortDir: DocumentSortDirection) {
  if (sortBy !== currentField) {
    return "↕";
  }
  return sortDir === "asc" ? "↑" : "↓";
}

interface DocumentTableHeaderProps {
  sortBy: DocumentSortField;
  sortDir: DocumentSortDirection;
  onSortChange: (field: DocumentSortField) => void;
  showActions?: boolean;
}

export function DocumentTableHeader({ sortBy, sortDir, onSortChange, showActions = true }: DocumentTableHeaderProps) {
  return (
    <thead className="bg-gray-50">
      <tr>
        <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
          <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => onSortChange("displayName")}>
            Name
            <span className="text-xs text-gray-500" aria-hidden="true">{getSortIndicator("displayName", sortBy, sortDir)}</span>
          </button>
        </th>
        <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
          <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => onSortChange("documentDate")}>
            Dokumentdatum
            <span className="text-xs text-gray-500" aria-hidden="true">{getSortIndicator("documentDate", sortBy, sortDir)}</span>
          </button>
        </th>
        <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
          <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => onSortChange("updatedAt")}>
            Geändert am
            <span className="text-xs text-gray-500" aria-hidden="true">{getSortIndicator("updatedAt", sortBy, sortDir)}</span>
          </button>
        </th>
        <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
          <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => onSortChange("mimeType")}>
            Typ
            <span className="text-xs text-gray-500" aria-hidden="true">{getSortIndicator("mimeType", sortBy, sortDir)}</span>
          </button>
        </th>
        <th className="px-3 py-2 text-right text-sm font-semibold text-gray-700">
          <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => onSortChange("sizeBytes")}>
            Größe
            <span className="text-xs text-gray-500" aria-hidden="true">{getSortIndicator("sizeBytes", sortBy, sortDir)}</span>
          </button>
        </th>
        {showActions && <th className="px-3 py-2 text-right text-sm font-semibold text-gray-700">Aktionen</th>}
      </tr>
    </thead>
  );
}

interface DirectoryRowProps {
  directory: DocumentDirectoryItem;
  searchQuery: string;
  onNavigate: (directoryId: string) => void;
  actions?: ReactNode;
  isDropTarget?: boolean;
  onDragOver?: (event: DragEvent<HTMLTableRowElement>) => void;
  onDragLeave?: (event: DragEvent<HTMLTableRowElement>) => void;
  onDrop?: (event: DragEvent<HTMLTableRowElement>) => void;
}

export function DirectoryRow({
  directory,
  searchQuery,
  onNavigate,
  actions,
  isDropTarget = false,
  onDragOver,
  onDragLeave,
  onDrop,
}: DirectoryRowProps) {
  return (
    <tr
      className={`border-t border-gray-100 hover:bg-gray-50 cursor-pointer ${isDropTarget ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}
      tabIndex={0}
      onClick={() => onNavigate(directory.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onNavigate(directory.id);
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <td className="px-3 py-2 text-sm text-gray-900">
        <span className="inline-flex items-center gap-2 font-medium">
          <FolderIcon className="w-5 h-5 text-amber-600" />
          <SearchHighlight text={directory.name} query={searchQuery} />
        </span>
      </td>
      <td className="px-3 py-2 text-sm text-gray-600">-</td>
      <td className="px-3 py-2 text-sm text-gray-600">-</td>
      <td className="px-3 py-2 text-sm text-gray-600">Dateiordner</td>
      <td className="px-3 py-2 text-sm text-right text-gray-600">{directory.documentCount}</td>
      <td className="px-3 py-2 text-right">
        {actions || <span className="text-gray-400">-</span>}
      </td>
    </tr>
  );
}

interface DocumentRowProps {
  document: DocumentItem;
  searchQuery: string;
  downloadUrlPrefix: string;
  onOpen?: (document: DocumentItem) => void;
  actions?: ReactNode;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLTableRowElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLTableRowElement>) => void;
}

export function DocumentRow({
  document,
  searchQuery,
  downloadUrlPrefix,
  onOpen,
  actions,
  draggable = false,
  onDragStart,
  onDragEnd,
}: DocumentRowProps) {
  const isViewable = isViewableDocument(document);
  const downloadUrl = `${downloadUrlPrefix}/${document.id}/download`;

  const handleRowClick = () => {
    if (isViewable && onOpen) {
      onOpen(document);
    }
  };

  const handleRowKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === "Enter" || event.key === " ") && isViewable && onOpen) {
      event.preventDefault();
      onOpen(document);
    }
  };

  return (
    <tr
      className={`border-t border-gray-100 ${isViewable && onOpen ? "hover:bg-gray-50" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : isViewable && onOpen ? "cursor-pointer" : ""}`}
      tabIndex={isViewable && onOpen ? 0 : -1}
      aria-disabled={isViewable && onOpen ? undefined : true}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <td className="px-3 py-2 text-sm text-gray-900">
        <span className="inline-flex items-center gap-2 font-medium">
          <FileIcon className="w-5 h-5 text-gray-500" />
          <SearchHighlight text={document.displayName} query={searchQuery} />
        </span>
        <p className="text-xs text-gray-500 ml-7">
          <SearchHighlight text={document.originalFileName} query={searchQuery} />
        </p>
        {!isViewable && (
          <span className="inline-flex ml-7 mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Nur Download
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-sm text-gray-700">{formatDateUtc(document.documentDate)}</td>
      <td className="px-3 py-2 text-sm text-gray-700">{formatDateTime(document.updatedAt)}</td>
      <td className="px-3 py-2 text-sm text-gray-700">{document.mimeType}</td>
      <td className="px-3 py-2 text-sm text-gray-700 text-right">{formatFileSize(document.sizeBytes)}</td>
      <td className="px-3 py-2 text-right">
        <div className="inline-flex items-center gap-1">
          <a
            className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 bg-white hover:bg-gray-50"
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download"
            title="Download"
            onClick={(event) => event.stopPropagation()}
          >
            <DownloadIcon className="w-4 h-4 text-gray-700" />
          </a>
          {onOpen && isViewable ? (
            <IconButton
              label="Vorschau"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(document);
              }}
            >
              <EyeIcon className="w-4 h-4 text-gray-700" />
            </IconButton>
          ) : (
            <button
              type="button"
              className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
              aria-label="Vorschau nicht verfügbar"
              title="Vorschau nicht verfügbar"
              disabled
              onClick={(event) => event.stopPropagation()}
            >
              <EyeOffIcon className="w-4 h-4" />
            </button>
          )}
          {actions}
        </div>
      </td>
    </tr>
  );
}

interface IconButtonProps {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
}

export function IconButton({ label, onClick, className, children, disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 bg-white hover:bg-gray-50 ${className || ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

interface EmptyRowProps {
  colSpan: number;
  message: string;
}

export function EmptyRow({ colSpan, message }: EmptyRowProps) {
  return (
    <tr>
      <td className="px-3 py-8 text-base text-gray-500 text-center" colSpan={colSpan}>
        {message}
      </td>
    </tr>
  );
}
