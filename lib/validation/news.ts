import { z } from "zod";
import type { FieldValidationConfig } from "./field-config";
import { requiredDateSchema, requiredTitleSchema } from "./core";

const requiredContentSchema = z
  .string()
  .trim()
  .min(1, "Inhalt ist erforderlich")
  .max(10000, "Inhalt darf maximal 10000 Zeichen haben");

export const validateContent = (content: string): boolean => {
  if (typeof content !== "string") return false;
  return requiredContentSchema.safeParse(content).success;
};

export const newsFormSchema = z.object({
  newsDate: requiredDateSchema,
  title: requiredTitleSchema,
  content: requiredContentSchema,
});

export const newsValidationConfig: Record<string, FieldValidationConfig> = {
  newsDate: { zod: requiredDateSchema },
  title: { zod: requiredTitleSchema },
  content: { zod: requiredContentSchema },
};
