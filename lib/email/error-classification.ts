import type { ClassifiedEmailError, ErrorWithCode } from "./types";
import { PERMANENT_ERROR_PATTERNS, TRANSIENT_ERROR_PATTERNS } from "./types";

export function classifyEmailError(error: Error): ClassifiedEmailError {
  const errorMessage = error.message.toLowerCase();
  const errorCode = (error as ErrorWithCode).code?.toLowerCase();

  const isPermanent = PERMANENT_ERROR_PATTERNS.some(
    pattern => errorMessage.includes(pattern) || errorCode === pattern
  );
  const isTransient = TRANSIENT_ERROR_PATTERNS.some(
    pattern => errorMessage.includes(pattern) || errorCode === pattern
  );

  if (isPermanent) {
    return {
      type: "permanent",
      originalError: error,
      message: `Permanent SMTP error: ${error.message}`,
    };
  }

  if (isTransient) {
    return {
      type: "transient",
      originalError: error,
      message: `Transient SMTP error: ${error.message}`,
    };
  }

  return {
    type: "unknown",
    originalError: error,
    message: `Unknown SMTP error: ${error.message}`,
  };
}
