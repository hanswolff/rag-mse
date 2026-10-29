// Gemeinsame Laufzeit für die Hintergrund-Worker (Erinnerungen, Postausgang,
// Wartung): globalThis-Singleton (übersteht Modul-Neuladen im Dev-Server),
// Reentrancy-Guard pro Tick, Test-Skip und Stop-Funktion für Tests.
// Die Worker liefern nur noch ihren Tick samt eigenem Logging.

export type IntervalWorkerConfig = {
  // Eindeutiger Schlüssel für den Singleton-Zustand in globalThis
  name: string;
  // Wird einmal beim Start ausgewertet (z. B. aus Env-Variablen)
  getIntervalMs: () => number;
  // Ein Verarbeitungslauf; Erfolgs-Logging gehört in den Worker selbst
  tick: () => Promise<void>;
  // Ein fehlgeschlagener Tick stoppt den Worker nicht, er wird nur gemeldet
  onTickError: (error: unknown) => void;
  // Nach dem Setzen des Singleton-Flags, vor dem ersten Tick
  // (z. B. Instanz-ID setzen, Start-Log schreiben)
  onStarted?: (intervalMs: number) => void;
  // Nach stopForTests (z. B. Instanz-ID zurücksetzen)
  onStopped?: () => void;
};

export type IntervalWorker = {
  start: () => void;
  stopForTests: () => void;
  isRunning: () => boolean;
};

type WorkerState = {
  started: boolean;
  tickRunning: boolean;
  timer?: ReturnType<typeof setInterval>;
};

const globalForWorkerRuntime = globalThis as typeof globalThis & {
  intervalWorkerStates?: Map<string, WorkerState>;
};

function getWorkerState(name: string): WorkerState {
  const states = (globalForWorkerRuntime.intervalWorkerStates ??= new Map());
  let state = states.get(name);
  if (!state) {
    state = { started: false, tickRunning: false };
    states.set(name, state);
  }
  return state;
}

export function createIntervalWorker(config: IntervalWorkerConfig): IntervalWorker {
  const state = getWorkerState(config.name);

  async function runTick(): Promise<void> {
    if (state.tickRunning) {
      return;
    }

    state.tickRunning = true;
    try {
      await config.tick();
    } catch (error) {
      config.onTickError(error);
    } finally {
      state.tickRunning = false;
    }
  }

  function start(): void {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    if (state.started) {
      return;
    }

    state.started = true;
    const intervalMs = config.getIntervalMs();
    config.onStarted?.(intervalMs);

    state.timer = setInterval(() => {
      void runTick();
    }, intervalMs);

    void runTick();
  }

  function stopForTests(): void {
    if (state.timer) {
      clearInterval(state.timer);
    }

    state.started = false;
    state.tickRunning = false;
    state.timer = undefined;
    config.onStopped?.();
  }

  return {
    start,
    stopForTests,
    isRunning: () => state.started,
  };
}
