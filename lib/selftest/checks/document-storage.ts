import { constants as fsConstants, promises as fs } from "node:fs";
import { prisma } from "@/lib/prisma";
import { getDocumentsDirectory, getDocumentFilePath } from "@/lib/document-storage";
import type { CheckVerdict, RegisteredCheck } from "../types";

const STORAGE_COMPONENT = "Dokumentenspeicher";
const SAMPLE_SIZE = 25;

async function checkDocumentStorage(): Promise<CheckVerdict> {
  const directory = getDocumentsDirectory();

  try {
    await fs.access(directory, fsConstants.R_OK | fsConstants.W_OK);
  } catch {
    return {
      status: "error",
      message: `Dokumenten-Verzeichnis nicht lesbar/beschreibbar: ${directory}`,
      details: { directory },
    };
  }

  // Sample a handful of records and confirm their files exist on disk. Read-only: only stat().
  const sample = await prisma.document.findMany({
    select: { id: true, storedFileName: true },
    orderBy: { createdAt: "desc" },
    take: SAMPLE_SIZE,
  });

  const missing: string[] = [];
  for (const doc of sample) {
    try {
      await fs.stat(getDocumentFilePath(doc.storedFileName));
    } catch {
      missing.push(doc.storedFileName);
    }
  }

  if (missing.length > 0) {
    return {
      status: "error",
      message: `${missing.length} von ${sample.length} geprüften Dokumentdateien fehlen auf der Festplatte`,
      details: { directory, sampled: sample.length, missingCount: missing.length },
    };
  }

  return {
    status: "ok",
    message:
      sample.length === 0
        ? "Verzeichnis beschreibbar, keine Dokumente vorhanden"
        : `Verzeichnis beschreibbar, ${sample.length} Dokumentdatei(en) geprüft`,
    details: { directory, sampled: sample.length },
  };
}

export const documentStorageChecks: RegisteredCheck[] = [
  { name: "storage.documents", component: STORAGE_COMPONENT, run: checkDocumentStorage },
];
