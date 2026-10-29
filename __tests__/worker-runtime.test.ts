import { createIntervalWorker, type IntervalWorkerConfig } from "@/lib/worker-runtime";

const INTERVAL_MS = 1000;

describe("createIntervalWorker", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let workerCounter = 0;

  function buildConfig(overrides: Partial<IntervalWorkerConfig> = {}): IntervalWorkerConfig {
    workerCounter += 1;
    return {
      name: `test-worker-${workerCounter}`,
      getIntervalMs: () => INTERVAL_MS,
      tick: jest.fn(async () => undefined),
      onTickError: jest.fn(),
      ...overrides,
    };
  }

  async function flushMicrotasks(): Promise<void> {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  }

  beforeEach(() => {
    jest.useFakeTimers();
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    jest.useRealTimers();
  });

  it("does not start in the test environment", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    const config = buildConfig();
    const worker = createIntervalWorker(config);

    worker.start();
    jest.advanceTimersByTime(INTERVAL_MS * 3);

    expect(config.tick).not.toHaveBeenCalled();
    expect(worker.isRunning()).toBe(false);
  });

  it("starts only once despite repeated start calls", async () => {
    const onStarted = jest.fn();
    const config = buildConfig({ onStarted });
    const worker = createIntervalWorker(config);

    worker.start();
    worker.start();

    expect(config.tick).toHaveBeenCalledTimes(1);
    expect(onStarted).toHaveBeenCalledTimes(1);
    expect(onStarted).toHaveBeenCalledWith(INTERVAL_MS);
    expect(worker.isRunning()).toBe(true);

    // Erster Tick abschließen lassen, dann löst genau ein Intervall aus
    await flushMicrotasks();
    jest.advanceTimersByTime(INTERVAL_MS);
    expect(config.tick).toHaveBeenCalledTimes(2);

    worker.stopForTests();
  });

  it("shares the singleton state between instances with the same name", () => {
    const configA = buildConfig();
    const configB = { ...buildConfig(), name: configA.name };
    const workerA = createIntervalWorker(configA);
    const workerB = createIntervalWorker(configB);

    workerA.start();
    workerB.start();

    expect(configA.tick).toHaveBeenCalledTimes(1);
    expect(configB.tick).not.toHaveBeenCalled();
    expect(workerB.isRunning()).toBe(true);

    workerA.stopForTests();
  });

  it("skips a tick while the previous one is still running", async () => {
    let resolveTick: (() => void) | undefined;
    const tick = jest.fn(
      () => new Promise<void>((resolve) => {
        resolveTick = resolve;
      })
    );
    const config = buildConfig({ tick });
    const worker = createIntervalWorker(config);

    worker.start();
    expect(tick).toHaveBeenCalledTimes(1);

    // Erster Tick läuft noch: Intervall-Aufrufe werden übersprungen
    jest.advanceTimersByTime(INTERVAL_MS * 2);
    expect(tick).toHaveBeenCalledTimes(1);

    resolveTick?.();
    await flushMicrotasks();

    jest.advanceTimersByTime(INTERVAL_MS);
    expect(tick).toHaveBeenCalledTimes(2);

    worker.stopForTests();
  });

  it("reports tick errors and keeps ticking afterwards", async () => {
    const error = new Error("tick failed");
    const tick = jest.fn(async () => {
      throw error;
    });
    const onTickError = jest.fn();
    const config = buildConfig({ tick, onTickError });
    const worker = createIntervalWorker(config);

    worker.start();
    await flushMicrotasks();

    expect(onTickError).toHaveBeenCalledWith(error);

    jest.advanceTimersByTime(INTERVAL_MS);
    expect(tick).toHaveBeenCalledTimes(2);

    worker.stopForTests();
  });

  it("stopForTests stops the interval, calls onStopped and allows a restart", () => {
    const onStopped = jest.fn();
    const config = buildConfig({ onStopped });
    const worker = createIntervalWorker(config);

    worker.start();
    expect(config.tick).toHaveBeenCalledTimes(1);

    worker.stopForTests();
    expect(worker.isRunning()).toBe(false);
    expect(onStopped).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(INTERVAL_MS * 3);
    expect(config.tick).toHaveBeenCalledTimes(1);

    worker.start();
    expect(config.tick).toHaveBeenCalledTimes(2);
    expect(worker.isRunning()).toBe(true);

    worker.stopForTests();
  });
});
