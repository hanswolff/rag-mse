import { z } from "zod";
import type { FieldValidationConfig } from "./field-config";
import { requiredTitleSchema } from "./core";

const requiredPollOptionSchema = z
  .string()
  .trim()
  .min(1, "Option darf nicht leer sein")
  .max(200, "Option darf maximal 200 Zeichen haben");

export const pollValidationConfig: Record<string, FieldValidationConfig> = {
  title: { zod: requiredTitleSchema },
  option: { zod: requiredPollOptionSchema },
};
