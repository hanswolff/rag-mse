import { z } from "zod";
import type { FieldValidationConfig } from "./field-config";
import { isValidIsoDate } from "./core";

const optionalDocumentDisplayNameSchema = z
  .string()
  .superRefine((value, ctx) => {
    const normalized = value.trim();
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dokumentenname darf nicht leer sein" });
      return;
    }

    if (normalized.length > 200) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dokumentenname darf maximal 200 Zeichen lang sein" });
    }
  });

const optionalDocumentDateSchema = z
  .string()
  .trim()
  .refine((value) => !value || isValidIsoDate(value), {
    message: "Ungültiges Dokumentdatum",
  });

const optionalDocumentDirectoryIdSchema = z
  .string()
  .trim()
  .max(100, "Ungültiges Verzeichnis");

export const documentValidationConfig: Record<string, FieldValidationConfig> = {
  displayName: { zod: optionalDocumentDisplayNameSchema },
  documentDate: { zod: optionalDocumentDateSchema },
  directoryId: { zod: optionalDocumentDirectoryIdSchema },
};
