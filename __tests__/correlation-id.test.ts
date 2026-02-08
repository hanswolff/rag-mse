import {
  generateCorrelationId,
  getCorrelationId,
  withCorrelationId,
  withNewCorrelationId,
  getOrCreateCorrelationId,
} from '../lib/correlation-id';

describe('generateCorrelationId', () => {
  it('should generate a correlation ID with timestamp and random part', () => {
    const id = generateCorrelationId();
    expect(id).toMatch(/^\d+-[a-z0-9]{7}$/);
  });

  it('should generate unique IDs', () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    expect(id1).not.toBe(id2);
  });

  it('should include timestamp prefix', () => {
    const id = generateCorrelationId();
    const timestamp = parseInt(id.split('-')[0], 10);
    expect(timestamp).toBeGreaterThan(Date.now() - 10000);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('should have 7 character random suffix', () => {
    const id = generateCorrelationId();
    const parts = id.split('-');
    expect(parts).toHaveLength(2);
    expect(parts[1]).toHaveLength(7);
  });
});

describe('getCorrelationId', () => {
  it('should return undefined outside of correlation context', () => {
    const id = getCorrelationId();
    expect(id).toBeUndefined();
  });

  it('should return the correlation ID inside context', () => {
    const testId = 'test-correlation-id-123';
    withCorrelationId(testId, () => {
      const id = getCorrelationId();
      expect(id).toBe(testId);
    });
  });

  it('should return undefined after context exits', () => {
    withCorrelationId('test-id', () => {
      expect(getCorrelationId()).toBe('test-id');
    });
    expect(getCorrelationId()).toBeUndefined();
  });
});

describe('withCorrelationId', () => {
  it('should set correlation ID for synchronous function', () => {
    const result = withCorrelationId('test-id-1', () => {
      return getCorrelationId();
    });
    expect(result).toBe('test-id-1');
  });

  it('should set correlation ID for async function', async () => {
    const result = await withCorrelationId('test-id-2', async () => {
      await Promise.resolve();
      return getCorrelationId();
    });
    expect(result).toBe('test-id-2');
  });

  it('should not affect outer correlation ID', () => {
    withCorrelationId('outer-id', () => {
      expect(getCorrelationId()).toBe('outer-id');

      withCorrelationId('inner-id', () => {
        expect(getCorrelationId()).toBe('inner-id');
      });

      expect(getCorrelationId()).toBe('outer-id');
    });
  });

  it('should propagate return value', () => {
    const result = withCorrelationId('test-id', () => 'return-value');
    expect(result).toBe('return-value');
  });

  it('should propagate exceptions', () => {
    expect(() => {
      withCorrelationId('test-id', () => {
        throw new Error('test error');
      });
    }).toThrow('test error');
  });
});

describe('withNewCorrelationId', () => {
  it('should generate and set a new correlation ID', () => {
    const id = withNewCorrelationId(() => getCorrelationId());
    expect(id).toBeDefined();
    expect(id).toMatch(/^\d+-[a-z0-9]{7}$/);
  });

  it('should generate different IDs on each call', () => {
    const id1 = withNewCorrelationId(() => getCorrelationId());
    const id2 = withNewCorrelationId(() => getCorrelationId());
    expect(id1).not.toBe(id2);
  });

  it('should work with async functions', async () => {
    const id = await withNewCorrelationId(async () => {
      await Promise.resolve();
      return getCorrelationId();
    });
    expect(id).toBeDefined();
    expect(id).toMatch(/^\d+-[a-z0-9]{7}$/);
  });

  it('should propagate return value', () => {
    const result = withNewCorrelationId(() => 'return-value');
    expect(result).toBe('return-value');
  });
});

describe('getOrCreateCorrelationId', () => {
  it('should generate new ID when no context exists', () => {
    const id = getOrCreateCorrelationId();
    expect(id).toBeDefined();
    expect(id).toMatch(/^\d+-[a-z0-9]{7}$/);
  });

  it('should return existing ID when context exists', () => {
    const contextId = 'existing-correlation-id';
    withCorrelationId(contextId, () => {
      const id = getOrCreateCorrelationId();
      expect(id).toBe(contextId);
    });
  });

  it('should not change existing correlation ID', () => {
    const id1 = withNewCorrelationId(() => {
      const id = getCorrelationId();
      const id2 = getOrCreateCorrelationId();
      expect(id).toBe(id2);
      return id;
    });
    expect(id1).toBeDefined();
  });

  it('should work with nested contexts', () => {
    withNewCorrelationId(() => {
      const outerId = getCorrelationId();
      withNewCorrelationId(() => {
        const innerId = getOrCreateCorrelationId();
        expect(innerId).not.toBe(outerId);
      });
      const outerIdAfter = getOrCreateCorrelationId();
      expect(outerIdAfter).toBe(outerId);
    });
  });
});
