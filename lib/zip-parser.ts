import { inflateRawSync } from "node:zlib";

export type ZipEntry = {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

const MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 4096;
const MAX_ZIP_ENTRY_COMPRESSED_BYTES = 4096;

export function readUint16LE(content: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > content.length) {
    return null;
  }
  return content[offset] | (content[offset + 1] << 8);
}

export function readUint32LE(content: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > content.length) {
    return null;
  }
  return (
    content[offset] |
    (content[offset + 1] << 8) |
    (content[offset + 2] << 16) |
    (content[offset + 3] << 24)
  ) >>> 0;
}

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function getZipEntries(content: Uint8Array): ZipEntry[] | null {
  if (content.length < 22) {
    return null;
  }

  const maxCommentLength = 0xffff;
  const minStart = Math.max(0, content.length - (22 + maxCommentLength));
  let eocdOffset = -1;

  for (let offset = content.length - 22; offset >= minStart; offset -= 1) {
    const signature = readUint32LE(content, offset);
    if (signature === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) {
    return null;
  }

  const totalEntries = readUint16LE(content, eocdOffset + 10);
  const centralDirectorySize = readUint32LE(content, eocdOffset + 12);
  const centralDirectoryOffset = readUint32LE(content, eocdOffset + 16);
  if (
    totalEntries === null ||
    centralDirectorySize === null ||
    centralDirectoryOffset === null ||
    totalEntries === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    return null;
  }

  if (centralDirectoryOffset + centralDirectorySize > content.length) {
    return null;
  }

  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    const signature = readUint32LE(content, offset);
    if (signature !== 0x02014b50) {
      return null;
    }

    const compressionMethod = readUint16LE(content, offset + 10);
    const compressedSize = readUint32LE(content, offset + 20);
    const uncompressedSize = readUint32LE(content, offset + 24);
    const fileNameLength = readUint16LE(content, offset + 28);
    const extraFieldLength = readUint16LE(content, offset + 30);
    const fileCommentLength = readUint16LE(content, offset + 32);
    const localHeaderOffset = readUint32LE(content, offset + 42);
    if (
      compressionMethod === null ||
      compressedSize === null ||
      uncompressedSize === null ||
      fileNameLength === null ||
      extraFieldLength === null ||
      fileCommentLength === null ||
      localHeaderOffset === null
    ) {
      return null;
    }

    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > content.length) {
      return null;
    }

    const fileName = decodeUtf8(content.slice(fileNameStart, fileNameEnd));
    entries.push({
      fileName,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset = fileNameEnd + extraFieldLength + fileCommentLength;
    if (offset > content.length) {
      return null;
    }
  }

  return entries;
}

export function getZipEntryContent(content: Uint8Array, entry: ZipEntry): Uint8Array | null {
  if (
    entry.uncompressedSize > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES
    || entry.compressedSize > MAX_ZIP_ENTRY_COMPRESSED_BYTES
  ) {
    return null;
  }

  const localHeaderOffset = entry.localHeaderOffset;
  const signature = readUint32LE(content, localHeaderOffset);
  if (signature !== 0x04034b50) {
    return null;
  }

  const fileNameLength = readUint16LE(content, localHeaderOffset + 26);
  const extraFieldLength = readUint16LE(content, localHeaderOffset + 28);
  if (fileNameLength === null || extraFieldLength === null) {
    return null;
  }

  const compressedDataOffset = localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const compressedDataEnd = compressedDataOffset + entry.compressedSize;
  if (compressedDataOffset < 0 || compressedDataEnd > content.length) {
    return null;
  }

  const compressedContent = content.slice(compressedDataOffset, compressedDataEnd);
  if (entry.compressionMethod === 0) {
    return compressedContent.length === entry.uncompressedSize ? compressedContent : null;
  }

  if (entry.compressionMethod === 8) {
    try {
      const inflated = inflateRawSync(Buffer.from(compressedContent));
      if (inflated.length === entry.uncompressedSize) {
        return new Uint8Array(inflated);
      }
      return null;
    } catch {
      return null;
    }
  }

  return null;
}
