import type { ZodType } from "zod";

export interface FieldValidationConfig {
  zod: ZodType<string>;
}

export interface ValidationConfig {
  [fieldName: string]: FieldValidationConfig;
}
