import { z } from "zod";
import type { FieldValidationConfig } from "./field-config";
import { nameRegex, requiredEmailSchema } from "./core";

const requiredContactNameSchema = z
  .string()
  .trim()
  .min(2, "Name muss mindestens 2 Zeichen lang sein")
  .max(100, "Name darf maximal 100 Zeichen lang sein")
  .regex(nameRegex, "Name enthält ungültige Zeichen");

const requiredMessageSchema = z
  .string()
  .trim()
  .min(10, "Nachricht muss mindestens 10 Zeichen lang sein")
  .max(2000, "Nachricht darf maximal 2000 Zeichen lang sein");

export const contactFormSchema = z.object({
  name: requiredContactNameSchema,
  email: requiredEmailSchema("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
  message: requiredMessageSchema,
});

export const contactValidationConfig: Record<string, FieldValidationConfig> = {
  name: { zod: requiredContactNameSchema },
  email: { zod: requiredEmailSchema("Bitte geben Sie eine gültige E-Mail-Adresse ein") },
  message: { zod: requiredMessageSchema },
};
