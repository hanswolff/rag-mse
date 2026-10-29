"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_FORMATS_LABEL,
  type DirectoryFilter,
} from "@/lib/document-utils";

export type DocumentAreaType = "ADMIN" | "MEMBER";

interface UseDocumentUploadOptions {
  area: DocumentAreaType;
  maxUploadMb: number;
  selectedDirectory: DirectoryFilter;
  setActionError: (message: string | null) => void;
  setSuccess: (message: string | null) => void;
  onUploaded: () => Promise<void>;
}

export type DocumentUploadState = ReturnType<typeof useDocumentUpload>;

// Kapselt Datei-Auswahl (inkl. Dropzone-Drag&Drop), Validierung und den
// XHR-Upload mit Fortschrittsanzeige für den Admin-Dokumentenbereich.
export function useDocumentUpload({
  area,
  maxUploadMb,
  selectedDirectory,
  setActionError,
  setSuccess,
  onUploaded,
}: UseDocumentUploadOptions) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [directoryId, setDirectoryId] = useState<DirectoryFilter>("root");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload-Ziel folgt dem gerade geöffneten Verzeichnis
  useEffect(() => {
    setDirectoryId(selectedDirectory);
  }, [selectedDirectory]);

  const acceptedUploadTypes = useMemo(
    () => new Set(
      DOCUMENT_UPLOAD_ACCEPT
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0)
    ),
    []
  );

  const validateUploadFile = useCallback((file: File): string | null => {
    const maxBytes = maxUploadMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return `Datei ist zu groß. Maximal ${maxUploadMb} MB erlaubt.`;
    }

    const fileType = file.type.trim().toLowerCase();
    const fileExtension = file.name.includes(".")
      ? `.${file.name.split(".").pop()?.toLowerCase() || ""}`
      : "";

    const isAcceptedType = acceptedUploadTypes.has(fileType);
    const isAcceptedExtension = fileExtension.length > 1 && acceptedUploadTypes.has(fileExtension);

    if (!isAcceptedType && !isAcceptedExtension) {
      return `Dateiformat nicht erlaubt. Erlaubte Formate: ${DOCUMENT_UPLOAD_FORMATS_LABEL}.`;
    }

    return null;
  }, [acceptedUploadTypes, maxUploadMb]);

  const resetFileInput = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const setUploadFile = useCallback((file: File | null) => {
    if (!file) {
      resetFileInput();
      return;
    }

    const fileError = validateUploadFile(file);
    if (fileError) {
      setActionError(fileError);
      setSuccess(null);
      resetFileInput();
      return;
    }

    setActionError(null);
    setSuccess(null);
    setSelectedFile(file);
  }, [resetFileInput, validateUploadFile, setActionError, setSuccess]);

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUploadFile(event.target.files?.[0] || null);
  };

  const handleDropZoneDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading) return;
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDropZoneDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading) return;
    event.dataTransfer.dropEffect = "copy";
    if (!isDragActive) {
      setIsDragActive(true);
    }
  };

  const handleDropZoneDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading) return;
    dragDepthRef.current = Math.max(dragDepthRef.current - 1, 0);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDropZoneDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading) return;
    dragDepthRef.current = 0;
    setIsDragActive(false);
    setUploadFile(event.dataTransfer.files?.[0] || null);
  };

  const handleDropZoneKeyDown = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setSuccess(null);

    if (!selectedFile) {
      setActionError("Bitte wählen Sie eine Datei aus.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("displayName", displayName);
      formData.append("documentDate", documentDate);
      formData.append("directoryId", directoryId === "root" ? "" : directoryId);
      formData.append("area", area);

      xhr.upload.onprogress = (progressEvent) => {
        if (!progressEvent.lengthComputable) return;
        const nextProgress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        setUploadProgress(nextProgress);
      };

      xhr.onreadystatechange = async () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) return;

        try {
          const payload = xhr.responseText ? JSON.parse(xhr.responseText) as { error?: string } : {};
          if (xhr.status < 200 || xhr.status >= 300) {
            throw new Error(payload.error || "Upload fehlgeschlagen");
          }

          setSuccess("Dokument wurde erfolgreich hochgeladen.");
          resetFileInput();
          setDisplayName("");
          setDocumentDate("");
          await onUploaded();
        } catch (uploadError: unknown) {
          setActionError(uploadError instanceof Error ? uploadError.message : "Upload fehlgeschlagen");
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
          resolve();
        }
      };

      xhr.open("POST", "/api/admin/documents");
      xhr.send(formData);
    });
  };

  return {
    selectedFile,
    displayName,
    documentDate,
    directoryId,
    isUploading,
    uploadProgress,
    isDragActive,
    fileInputRef,
    setDisplayName,
    setDocumentDate,
    setDirectoryId,
    handleFileInputChange,
    handleDropZoneDragEnter,
    handleDropZoneDragOver,
    handleDropZoneDragLeave,
    handleDropZoneDrop,
    handleDropZoneKeyDown,
    handleUpload,
  };
}
