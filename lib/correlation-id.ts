import { AsyncLocalStorage } from 'async_hooks';
import { randomInt } from 'crypto';

const asyncLocalStorage = new AsyncLocalStorage<string>();

const BASE36_MAX = 36 ** 7;

export function generateCorrelationId(): string {
  return `${Date.now()}-${randomInt(BASE36_MAX).toString(36).padStart(7, '0')}`;
}

export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore();
}

export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  return asyncLocalStorage.run(correlationId, fn);
}

export function withNewCorrelationId<T>(fn: () => T): T {
  const correlationId = generateCorrelationId();
  return asyncLocalStorage.run(correlationId, fn);
}

export function getOrCreateCorrelationId(): string {
  const existingId = getCorrelationId();
  if (existingId) {
    return existingId;
  }
  return generateCorrelationId();
}
