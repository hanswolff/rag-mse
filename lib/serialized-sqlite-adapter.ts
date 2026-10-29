import type { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

type AdapterFactory = Pick<PrismaBetterSqlite3, "provider" | "adapterName" | "connect">;
type DriverAdapter = Awaited<ReturnType<PrismaBetterSqlite3["connect"]>>;
type DriverTransaction = Awaited<ReturnType<DriverAdapter["startTransaction"]>>;

type Release = () => void;

function createMutex() {
  let tail: Promise<void> = Promise.resolve();

  async function acquire(): Promise<Release> {
    let release!: Release;
    const freed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = tail;
    tail = previous.then(() => freed);
    await previous;
    return release;
  }

  async function runExclusive<T>(action: () => Promise<T>): Promise<T> {
    const release = await acquire();
    try {
      return await action();
    } finally {
      release();
    }
  }

  return { acquire, runExclusive };
}

type Mutex = ReturnType<typeof createMutex>;

const ROLLBACK = { sql: "ROLLBACK", args: [], argTypes: [] };

function releaseOnEnd(tx: DriverTransaction, release: Release): DriverTransaction {
  let ended = false;

  const end = async (finish: () => Promise<void>) => {
    try {
      await finish();
    } finally {
      ended = true;
      release();
    }
  };

  // Nach dem Freigeben gehört die Verbindung anderen: späte Abfragen dieser
  // Transaktion (z. B. nach Prismas Timeout) dürfen nicht mehr durchlaufen.
  const whileOpen = <T>(action: () => Promise<T>): Promise<T> =>
    ended ? Promise.reject(new Error("Transaktion ist bereits beendet")) : action();

  return {
    provider: tx.provider,
    adapterName: tx.adapterName,
    options: tx.options,
    queryRaw: (query) => whileOpen(() => tx.queryRaw(query)),
    executeRaw: (query) => whileOpen(() => tx.executeRaw(query)),
    commit: () => end(() => tx.commit()),
    // Prisma ruft rollback() auch nach einem gescheiterten COMMIT, ohne ROLLBACK zu
    // senden; SQLite ließe die Transaktion dann auf der Verbindung offen. Nach einem
    // regulären ROLLBACK scheitert dieser zweite nur mit "no transaction is active".
    rollback: () =>
      end(async () => {
        await tx.executeRaw(ROLLBACK).catch(() => undefined);
        await tx.rollback();
      }),
    ...(tx.createSavepoint && { createSavepoint: (name: string) => whileOpen(() => tx.createSavepoint!(name)) }),
    ...(tx.rollbackToSavepoint && {
      rollbackToSavepoint: (name: string) => whileOpen(() => tx.rollbackToSavepoint!(name)),
    }),
    ...(tx.releaseSavepoint && {
      releaseSavepoint: (name: string) => whileOpen(() => tx.releaseSavepoint!(name)),
    }),
  };
}

function serialize(adapter: DriverAdapter, mutex: Mutex): DriverAdapter {
  return {
    provider: adapter.provider,
    adapterName: adapter.adapterName,
    queryRaw: (query) => mutex.runExclusive(() => adapter.queryRaw(query)),
    executeRaw: (query) => mutex.runExclusive(() => adapter.executeRaw(query)),
    executeScript: (script) => mutex.runExclusive(() => adapter.executeScript(script)),
    async startTransaction(isolationLevel) {
      const release = await mutex.acquire();
      try {
        return releaseOnEnd(await adapter.startTransaction(isolationLevel), release);
      } catch (error) {
        release();
        throw error;
      }
    },
    ...(adapter.getConnectionInfo && {
      getConnectionInfo: () => adapter.getConnectionInfo!(),
    }),
    dispose: () => adapter.dispose(),
  };
}

export function serializedSqliteAdapter(factory: AdapterFactory): AdapterFactory {
  const mutex = createMutex();
  return {
    provider: factory.provider,
    adapterName: factory.adapterName,
    connect: async () => serialize(await factory.connect(), mutex),
  };
}
