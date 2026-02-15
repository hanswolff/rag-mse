import { getCorrelationId } from './correlation-id';

type LogLevel = 'info' | 'error' | 'warn';

type LogContext = {
  [key: string]: unknown;
};

const SENSITIVE_FIELDS = [
  'token',
  'password',
  'authorization',
  'cookie',
  'smtpPassword',
  'smtp_password',
  'smtpUser',
  'smtp_user',
] as const;

type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

function isSensitiveField(key: string): key is SensitiveField {
  return SENSITIVE_FIELDS.some(field => key.toLowerCase() === field.toLowerCase());
}

export function maskToken(token: string): string {
  if (!token || token.length <= 6) {
    return '***';
  }
  return `${token.slice(0, 6)}...`;
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '***@***.***';
  }
  const atIndex = email.indexOf('@');
  const localPart = email.substring(0, atIndex);
  if (localPart.length <= 3) {
    return `${localPart}***${email.substring(atIndex)}`;
  }
  return `${localPart.substring(0, 3)}***${localPart.substring(localPart.length - 1)}${email.substring(atIndex)}`;
}

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => redactValue(item));
  }

  if (typeof value === 'object') {
    return redactObject(value as Record<string, unknown>);
  }

  return value;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactValue(value);
    }
  }

  return result;
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function formatLogEntry(
  level: LogLevel,
  action: string,
  message: string,
  context: LogContext = {}
): string {
  const redactedContext = redactObject(context);
  const correlationId = getCorrelationId();
  const correlationIdStr = correlationId ? `[${correlationId}] ` : '';
  const contextStr = Object.keys(redactedContext).length > 0
    ? ` ${JSON.stringify(redactedContext)}`
    : '';
  return `[${getTimestamp()}] ${correlationIdStr}[${level.toUpperCase()}] [${action}] ${message}${contextStr}`;
}

export function logInfo(action: string, message: string, context: LogContext = {}): void {
  console.log(formatLogEntry('info', action, message, context));
}

export function logError(action: string, message: string, context: LogContext = {}): void {
  console.error(formatLogEntry('error', action, message, context));
}

export function logWarn(action: string, message: string, context: LogContext = {}): void {
  console.warn(formatLogEntry('warn', action, message, context));
}

export function logResourceNotFound(resourceType: string, resourceId: string, route: string, method: string, context: LogContext = {}): void {
  logWarn('resource_not_found', `${resourceType} not found`, {
    resourceType,
    resourceId,
    route,
    method,
    ...context,
  });
}

export function logValidationFailure(route: string, method: string, errors: string | string[], context: LogContext = {}): void {
  logWarn('validation_failed', 'Request validation failed', {
    route,
    method,
    errors: Array.isArray(errors) ? errors : [errors],
    ...context,
  });
}
