import { NextRequest, NextResponse } from 'next/server';
import { withNewCorrelationId, getOrCreateCorrelationId, getCorrelationId } from './correlation-id';

export { getOrCreateCorrelationId } from './correlation-id';

export function addCorrelationIdHeaders(response: NextResponse): NextResponse {
  const correlationId = getOrCreateCorrelationId();
  response.headers.set('X-Correlation-Id', correlationId);
  return response;
}

export function withCorrelationId<T extends NextRequest>(
  handler: (request: T) => Promise<NextResponse>
): (request: T) => Promise<NextResponse> {
  return async (request: T) => {
    if (getCorrelationId()) {
      const response = await handler(request);
      return addCorrelationIdHeaders(response);
    }
    return withNewCorrelationId(async () => {
      const response = await handler(request);
      return addCorrelationIdHeaders(response);
    });
  };
}
