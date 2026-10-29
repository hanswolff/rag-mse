// Reiner Re-Export-Shim: Die Validierung ist nach Domäne in lib/validation/*
// aufgeteilt; bestehende Importe aus "@/lib/validation-schema" funktionieren weiter.
export {
  emailRegex,
  phoneRegex,
  nameRegex,
  timeRegex,
  requiredNameSchema,
  requiredEmailSchema,
  validateEmail,
  validatePhone,
  validateAddress,
  validateName,
  validateDateString,
  validateTimeString,
  validateTitle,
  validateLatitude,
  validateLongitude,
} from "./validation/core";

export {
  VALID_ROLES,
  validateRole,
  profileFormSchema,
  userValidationConfig,
  profileValidationConfig,
  adminUserValidationConfig,
} from "./validation/profile";

export {
  MAX_EVENT_TITLE_LENGTH,
  MAX_EVENT_COST_LENGTH,
  EVENT_CAPACITY_ERROR,
  validateLocation,
  validateDescription,
  validateEventTitle,
  validateEventCost,
  validateEventCapacity,
  validateEventType,
  eventFormSchema,
  eventValidationConfig,
} from "./validation/event";

export { validateContent, newsFormSchema, newsValidationConfig } from "./validation/news";

export { contactFormSchema, contactValidationConfig } from "./validation/contact";

export {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  createPasswordSchema,
  hasMinimumLength,
  hasUppercase,
  hasLowercase,
  hasDigit,
  validatePassword,
  getPasswordRequirements,
  passwordChangeFormSchema,
  loginFormSchema,
  forgotPasswordFormSchema,
  resetPasswordFormSchema,
  passwordChangeValidationConfig,
} from "./validation/password";

export { shootingRangeFormSchema, shootingRangeValidationConfig } from "./validation/range";

export { pollValidationConfig } from "./validation/poll";

export { documentValidationConfig } from "./validation/document";

export {
  periodShape,
  addPeriodIssues,
  normalizePeriod,
  periodToStorage,
  periodFromStorage,
  PERIOD_END_BEFORE_START_ERROR,
  PERIOD_START_LABEL,
  PERIOD_END_LABEL,
  PERIOD_TIME_ORDER_ERROR,
} from "./validation/period";
export type { PeriodInput, NormalizedPeriod, StoredPeriod } from "./validation/period";

export {
  MAX_EXTERNAL_EVENT_LOCATION_LENGTH,
  MAX_EXTERNAL_EVENT_DESCRIPTION_LENGTH,
  MAX_EXTERNAL_EVENT_URL_LENGTH,
  externalEventFormSchema,
  externalEventValidationConfig,
} from "./validation/external-event";
export type { ExternalEventFormInput } from "./validation/external-event";

export { MAX_ABSENCE_REASON_LENGTH, absenceFormSchema, absenceValidationConfig } from "./validation/absence";
export type { AbsenceFormInput } from "./validation/absence";
