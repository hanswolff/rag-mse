import { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, RefObject, ReactNode } from "react";
import { GermanDatePicker } from "@/components/german-date-picker";
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_FORMATS_LABEL,
  type DirectoryFilter,
} from "@/lib/document-utils";
import type { DocumentDirectoryItem } from "@/types";

type DocumentUploadProps = {
  selectedFile: File | null;
  uploadDisplayName: string;
  uploadDocumentDate: string;
  uploadDirectoryId: DirectoryFilter;
  isUploading: boolean;
  uploadProgress: number;
  isDragActive: boolean;
  directories: DocumentDirectoryItem[];
  maxUploadMb: number;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDropZoneDragEnter: (event: DragEvent<HTMLLabelElement>) => void;
  onDropZoneDragOver: (event: DragEvent<HTMLLabelElement>) => void;
  onDropZoneDragLeave: (event: DragEvent<HTMLLabelElement>) => void;
  onDropZoneDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onDropZoneKeyDown: (event: KeyboardEvent<HTMLLabelElement>) => void;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
  onUploadDirectoryChange: (directoryId: string) => void;
  onUploadDisplayNameChange: (name: string) => void;
  onUploadDocumentDateChange: (date: string) => void;
};

export function DocumentUpload({
  selectedFile,
  uploadDisplayName,
  uploadDocumentDate,
  uploadDirectoryId,
  isUploading,
  uploadProgress,
  isDragActive,
  directories,
  maxUploadMb,
  fileInputRef,
  onFileInputChange,
  onDropZoneDragEnter,
  onDropZoneDragOver,
  onDropZoneDragLeave,
  onDropZoneDrop,
  onDropZoneKeyDown,
  onUpload,
  onUploadDirectoryChange,
  onUploadDisplayNameChange,
  onUploadDocumentDateChange,
}: DocumentUploadProps): ReactNode {
  return (
    <section className="card-compact mb-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Neues Dokument hochladen</h2>
      <form onSubmit={onUpload} className="space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)] gap-4">
          <div>
            <label htmlFor="document-file" className="form-label">Datei</label>
            <label
              htmlFor="document-file"
              className={`upload-dropzone ${isDragActive ? "upload-dropzone-active" : ""} ${isUploading ? "upload-dropzone-disabled" : ""}`}
              role="button"
              tabIndex={isUploading ? -1 : 0}
              aria-disabled={isUploading}
              aria-describedby="document-upload-help"
              onDragEnter={onDropZoneDragEnter}
              onDragOver={onDropZoneDragOver}
              onDragLeave={onDropZoneDragLeave}
              onDrop={onDropZoneDrop}
              onKeyDown={onDropZoneKeyDown}
            >
              <span className="upload-dropzone-title">
                {selectedFile ? selectedFile.name : "Datei hierhin ziehen oder anklicken"}
              </span>
              <span className="upload-dropzone-subtitle">
                {selectedFile
                  ? `${Math.max(selectedFile.size / (1024 * 1024), 0.01).toFixed(2)} MB`
                  : "Drag & Drop wird unterstützt"}
              </span>
            </label>
            <input
              id="document-file"
              ref={fileInputRef}
              type="file"
              accept={DOCUMENT_UPLOAD_ACCEPT}
              className="sr-only"
              onChange={onFileInputChange}
              disabled={isUploading}
            />
            <p id="document-upload-help" className="form-help">Erlaubte Formate: {DOCUMENT_UPLOAD_FORMATS_LABEL}. Maximal {maxUploadMb} MB.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="document-directory" className="form-label">Verzeichnis</label>
              <select
                id="document-directory"
                className="form-input"
                value={uploadDirectoryId}
                onChange={(event) => onUploadDirectoryChange(event.target.value)}
                disabled={isUploading}
              >
                <option value="root">/</option>
                {directories.map((directory) => (
                  <option key={directory.id} value={directory.id}>
                    {directory.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button type="submit" className="w-full btn-primary px-4 py-2 text-base" disabled={isUploading}>
                {isUploading ? "Wird hochgeladen..." : "Dokument hochladen"}
              </button>
              {isUploading && (
                <div className="w-full mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-brand-red-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Upload-Fortschritt: {uploadProgress}%</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <details className="rounded-md border border-gray-200 bg-gray-50 p-3 sm:p-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-gray-700">
            Erweitert (optional)
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="document-display-name" className="form-label">Dokumentenname</label>
              <input
                id="document-display-name"
                type="text"
                className="form-input"
                value={uploadDisplayName}
                onChange={(event) => onUploadDisplayNameChange(event.target.value)}
                placeholder="Optional (sonst Dateiname)"
                disabled={isUploading}
                maxLength={200}
              />
            </div>

            <GermanDatePicker
              id="document-date"
              value={uploadDocumentDate || null}
              onChange={(nextDate) => onUploadDocumentDateChange(nextDate)}
              label="Dokumentdatum"
              disabled={isUploading}
            />
          </div>
        </details>
      </form>
    </section>
  );
}
