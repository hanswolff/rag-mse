import { decodeUtf8, getZipEntries, getZipEntryContent, readUint32LE } from "./zip-parser";

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ODT_MIME_TYPE = "application/vnd.oasis.opendocument.text";
const ODS_MIME_TYPE = "application/vnd.oasis.opendocument.spreadsheet";

type MagicPattern = { offset: number; bytes: readonly number[] };

export type DocumentFormat = {
  mimeType: string;
  extensions: readonly string[];
  magic?: readonly MagicPattern[];
};

// Einzige Quelle für erlaubte Dokumentformate: MIME-Typ, Dateiendungen und
// Magic Bytes. Office-Formate (ohne `magic`) werden über den ZIP-Inhalt erkannt.
export const DOCUMENT_FORMATS: readonly DocumentFormat[] = [
  {
    mimeType: "application/pdf",
    extensions: ["pdf"],
    magic: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }],
  },
  {
    mimeType: "image/jpeg",
    extensions: ["jpg", "jpeg"],
    magic: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  },
  {
    mimeType: "image/png",
    extensions: ["png"],
    magic: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  },
  {
    mimeType: "image/webp",
    extensions: ["webp"],
    magic: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ],
  },
  { mimeType: DOCX_MIME_TYPE, extensions: ["docx"] },
  { mimeType: XLSX_MIME_TYPE, extensions: ["xlsx"] },
  { mimeType: ODT_MIME_TYPE, extensions: ["odt"] },
  { mimeType: ODS_MIME_TYPE, extensions: ["ods"] },
];

export const ALLOWED_DOCUMENT_MIME_TYPES: readonly string[] = DOCUMENT_FORMATS.map(
  (format) => format.mimeType,
);

export const ALLOWED_DOCUMENT_EXTENSIONS: readonly string[] = DOCUMENT_FORMATS.flatMap(
  (format) => [...format.extensions],
);

export const DOCUMENT_UPLOAD_FORMATS_LABEL = ALLOWED_DOCUMENT_EXTENSIONS.map((extension) =>
  extension.toUpperCase(),
).join(", ");

// Office-Formate zusätzlich als Dateiendung: manche Browser/Betriebssysteme
// melden für sie keinen (oder einen generischen) MIME-Typ im File-Dialog.
export const DOCUMENT_UPLOAD_ACCEPT = [
  ...ALLOWED_DOCUMENT_MIME_TYPES,
  ...DOCUMENT_FORMATS.filter((format) => !format.magic).flatMap((format) =>
    format.extensions.map((extension) => `.${extension}`),
  ),
].join(",");

export function getExtensionForMimeType(mimeType: string): string | null {
  const format = DOCUMENT_FORMATS.find((entry) => entry.mimeType === mimeType.toLowerCase());
  return format ? format.extensions[0] : null;
}

function matchesMagic(content: Uint8Array, magic: readonly MagicPattern[]): boolean {
  return magic.every((pattern) =>
    pattern.bytes.every((byte, index) => content[pattern.offset + index] === byte),
  );
}

export function detectAllowedMimeTypeFromContent(content: Uint8Array): string | null {
  for (const format of DOCUMENT_FORMATS) {
    if (format.magic && matchesMagic(content, format.magic)) {
      return format.mimeType;
    }
  }

  const officeMimeType = detectOfficeMimeTypeFromZipContent(content);
  if (officeMimeType) {
    return officeMimeType;
  }

  return null;
}

function detectOfficeMimeTypeFromZipContent(content: Uint8Array): string | null {
  if (content.length < 4) {
    return null;
  }

  const signature = readUint32LE(content, 0);
  if (signature !== 0x04034b50) {
    return null;
  }

  const entries = getZipEntries(content);
  if (!entries || entries.length === 0) {
    return null;
  }

  const entryNames = new Set(entries.map((entry) => entry.fileName.toLowerCase()));
  if (entryNames.has("[content_types].xml") && entryNames.has("word/document.xml")) {
    return DOCX_MIME_TYPE;
  }

  if (entryNames.has("[content_types].xml") && entryNames.has("xl/workbook.xml")) {
    return XLSX_MIME_TYPE;
  }

  const mimetypeEntry = entries.find((entry) => entry.fileName.toLowerCase() === "mimetype");
  if (!mimetypeEntry) {
    return null;
  }

  const mimetypeContent = getZipEntryContent(content, mimetypeEntry);
  if (!mimetypeContent) {
    return null;
  }

  const mimetype = decodeUtf8(mimetypeContent).trim();
  if (mimetype === ODT_MIME_TYPE) {
    return ODT_MIME_TYPE;
  }

  if (mimetype === ODS_MIME_TYPE) {
    return ODS_MIME_TYPE;
  }

  return null;
}
