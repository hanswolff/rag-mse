import { decodeUtf8, getZipEntries, getZipEntryContent, readUint32LE } from "./zip-parser";

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ODT_MIME_TYPE = "application/vnd.oasis.opendocument.text";
const ODS_MIME_TYPE = "application/vnd.oasis.opendocument.spreadsheet";

export function detectAllowedMimeTypeFromContent(content: Uint8Array): string | null {
  if (content.length >= 5) {
    const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2d];
    if (pdfHeader.every((byte, index) => content[index] === byte)) {
      return "application/pdf";
    }
  }

  if (content.length >= 3) {
    const jpgHeader = [0xff, 0xd8, 0xff];
    if (jpgHeader.every((byte, index) => content[index] === byte)) {
      return "image/jpeg";
    }
  }

  if (content.length >= 8) {
    const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (pngHeader.every((byte, index) => content[index] === byte)) {
      return "image/png";
    }
  }

  if (content.length >= 12) {
    const riffHeader = [0x52, 0x49, 0x46, 0x46];
    const webpHeader = [0x57, 0x45, 0x42, 0x50];
    const hasRiff = riffHeader.every((byte, index) => content[index] === byte);
    const hasWebp = webpHeader.every((byte, index) => content[index + 8] === byte);
    if (hasRiff && hasWebp) {
      return "image/webp";
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
