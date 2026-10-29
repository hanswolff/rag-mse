import { z } from "zod";
import type { FieldValidationConfig } from "./field-config";
import { createCoordinateSchema } from "./core";

const requiredRangeNameSchema = z
  .string()
  .trim()
  .min(1, "Name ist erforderlich")
  .max(100, "Name darf maximal 100 Zeichen lang sein");

const optionalStreetSchema = z
  .string()
  .trim()
  .max(200, "Straße darf maximal 200 Zeichen lang sein");

const optionalPostalCodeSchema = z
  .string()
  .trim()
  .max(10, "PLZ darf maximal 10 Zeichen lang sein");

const optionalCitySchema = z
  .string()
  .trim()
  .max(100, "Ort darf maximal 100 Zeichen lang sein");

const requiredLatitudeSchema = createCoordinateSchema(-90, 90, "Breitengrad", true);
const requiredLongitudeSchema = createCoordinateSchema(-180, 180, "Längengrad", true);

export const shootingRangeFormSchema = z.object({
  name: requiredRangeNameSchema,
  street: optionalStreetSchema,
  postalCode: optionalPostalCodeSchema,
  city: optionalCitySchema,
  latitude: requiredLatitudeSchema,
  longitude: requiredLongitudeSchema,
});

export const shootingRangeValidationConfig: Record<string, FieldValidationConfig> = {
  name: { zod: requiredRangeNameSchema },
  street: { zod: optionalStreetSchema },
  postalCode: { zod: optionalPostalCodeSchema },
  city: { zod: optionalCitySchema },
  latitude: { zod: requiredLatitudeSchema },
  longitude: { zod: requiredLongitudeSchema },
};
