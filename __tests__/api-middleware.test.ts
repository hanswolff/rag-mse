import { NextRequest, NextResponse } from 'next/server';
import { addCorrelationIdHeaders, withCorrelationId as withCorrelationIdMiddleware } from '../lib/api-middleware';
import { getCorrelationId, withCorrelationId } from '../lib/correlation-id';

describe('addCorrelationIdHeaders', () => {
  it('should add X-Correlation-Id header to response', () => {
    const testId = 'test-correlation-id-123';
    withCorrelationId(testId, () => {
      const response = NextResponse.json({ success: true });
      const modifiedResponse = addCorrelationIdHeaders(response);

      expect(modifiedResponse.headers.get('X-Correlation-Id')).toBe(testId);
    });
  });

  it('should generate new correlation ID if none exists', () => {
    const response = NextResponse.json({ success: true });
    const modifiedResponse = addCorrelationIdHeaders(response);

    const correlationId = modifiedResponse.headers.get('X-Correlation-Id');
    expect(correlationId).toBeDefined();
    expect(correlationId).toMatch(/^\d+-[a-z0-9]{7}$/);
  });

  it('should preserve existing response headers', () => {
    const testId = 'test-id-456';
    withCorrelationId(testId, () => {
      const response = NextResponse.json({ success: true });
      response.headers.set('Content-Type', 'application/json');
      response.headers.set('X-Custom-Header', 'custom-value');

      const modifiedResponse = addCorrelationIdHeaders(response);

      expect(modifiedResponse.headers.get('Content-Type')).toBe('application/json');
      expect(modifiedResponse.headers.get('X-Custom-Header')).toBe('custom-value');
      expect(modifiedResponse.headers.get('X-Correlation-Id')).toBe(testId);
    });
  });

  it('should preserve response body', () => {
    const testId = 'test-id-789';
    withCorrelationId(testId, () => {
      const testData = { message: 'test data', value: 42 };
      const response = NextResponse.json(testData);
      const modifiedResponse = addCorrelationIdHeaders(response);

      const body = modifiedResponse.json();
      expect(body).resolves.toEqual(testData);
    });
  });

  it('should overwrite existing X-Correlation-Id header', () => {
    const testId = 'new-correlation-id';
    withCorrelationId(testId, () => {
      const response = NextResponse.json({ success: true });
      response.headers.set('X-Correlation-Id', 'old-id');

      const modifiedResponse = addCorrelationIdHeaders(response);

      expect(modifiedResponse.headers.get('X-Correlation-Id')).toBe(testId);
    });
  });
});

describe('withCorrelationId (middleware)', () => {
  it('should wrap handler and add correlation ID to response', async () => {
    const mockHandler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));

    const wrappedHandler = withCorrelationIdMiddleware(mockHandler);
    const request = new NextRequest('http://localhost/api/test', { method: 'POST' });

    const response = await wrappedHandler(request);

    expect(response.headers.get('X-Correlation-Id')).toBeDefined();
    expect(response.headers.get('X-Correlation-Id')).toMatch(/^\d+-[a-z0-9]{7}$/);
  });

  it('should call the original handler with the request', async () => {
    const mockHandler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));

    const wrappedHandler = withCorrelationIdMiddleware(mockHandler);
    const request = new NextRequest('http://localhost/api/test', { method: 'POST' });

    await wrappedHandler(request);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(request);
  });

  it('should preserve correlation ID within handler context', async () => {
    let handlerCorrelationId: string | undefined;

    const mockHandler = jest.fn().mockImplementation(async () => {
      handlerCorrelationId = getCorrelationId();
      return NextResponse.json({ success: true });
    });

    const wrappedHandler = withCorrelationIdMiddleware(mockHandler);
    const request = new NextRequest('http://localhost/api/test', { method: 'POST' });

    const response = await wrappedHandler(request);

    expect(handlerCorrelationId).toBeDefined();
    expect(handlerCorrelationId).toBe(response.headers.get('X-Correlation-Id'));
  });

  it('should propagate handler errors', async () => {
    const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'));

    const wrappedHandler = withCorrelationIdMiddleware(mockHandler);
    const request = new NextRequest('http://localhost/api/test', { method: 'POST' });

    await expect(wrappedHandler(request)).rejects.toThrow('Handler error');
  });

  it('should propagate handler return value', async () => {
    const testData = { message: 'test response' };
    const mockHandler = jest.fn().mockResolvedValue(NextResponse.json(testData));

    const wrappedHandler = withCorrelationIdMiddleware(mockHandler);
    const request = new NextRequest('http://localhost/api/test', { method: 'POST' });

    const response = await wrappedHandler(request);

    const body = await response.json();
    expect(body).toEqual(testData);
  });

  it('should generate unique correlation IDs for each request', async () => {
    const mockHandler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));

    const wrappedHandler = withCorrelationIdMiddleware(mockHandler);
    const request = new NextRequest('http://localhost/api/test', { method: 'POST' });

    const correlationIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const response = await wrappedHandler(request);
      const id = response.headers.get('X-Correlation-Id');
      expect(id).toBeDefined();
      expect(id).toMatch(/^\d+-[a-z0-9]{7}$/);
      correlationIds.push(id!);
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    const uniqueIds = new Set(correlationIds);
    expect(uniqueIds.size).toBeGreaterThan(1);
  });

  it('should work with different HTTP methods', async () => {
    const mockHandler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));

    const wrappedHandler = withCorrelationIdMiddleware(mockHandler);

    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

    for (const method of methods) {
      const request = new NextRequest('http://localhost/api/test', { method });
      const response = await wrappedHandler(request);

      expect(response.headers.get('X-Correlation-Id')).toBeDefined();
    }
  });
});
