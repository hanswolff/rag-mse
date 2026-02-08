import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<string>();

export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
