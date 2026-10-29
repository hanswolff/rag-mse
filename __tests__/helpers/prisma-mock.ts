import type { PrismaClient } from "@prisma/client";

/**
 * Zentraler Proxy-basierter Prisma-Deep-Mock für die Unit-Schicht.
 *
 * Verwendung im Testfile (requireActual statt Import-Referenz, weil jest.mock
 * über die ESM-Import-Initialisierung gehoistet wird):
 *
 *   jest.mock("@/lib/prisma", () =>
 *     jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
 *   );
 *
 * Jede Model-Methode ist automatisch ein `jest.fn()` (typisiert, kein
 * `as jest.Mock`-Cast nötig): `mockPrisma.poll.findMany.mockResolvedValue(...)`.
 *
 * `$transaction` ruft per Default den Callback mit dem Mock selbst als
 * tx-Client auf (Array-Form: `Promise.all`); Tests können das wie bisher mit
 * `mockImplementation` überschreiben. `$queryRaw` liefert per Default keine
 * Zeilen. `jest.clearAllMocks()` lässt die Default-Implementierungen intakt.
 */

type MockedModel<T> = { [M in keyof T]: jest.Mock };

export type PrismaMock = {
  [K in Exclude<keyof PrismaClient, symbol | `$${string}`>]: MockedModel<PrismaClient[K]>;
} & Record<`$${string}`, jest.Mock>;

// Props, die Jest/pretty-format/Promise-Erkennung an beliebigen Objekten abfragen
// (z. B. beim toEqual-Vergleich eines tx-Clients) — nie als Modell behandeln.
const BLOCKED_PROPS = new Set([
  "then",
  "__esModule",
  "constructor",
  "toJSON",
  "nodeType",
  "asymmetricMatch",
  "$$typeof",
  "_isMockFunction",
  "@@__IMMUTABLE_ITERABLE__@@",
  "@@__IMMUTABLE_RECORD__@@",
  "@@__IMMUTABLE_ORDERED__@@",
  "toString",
  "valueOf",
  "inspect",
  "length",
]);

// Gegen Mock-Drift: Tippfehler oder umbenannte Modelle/Methoden im Produktivcode
// (z. B. `prisma.pollVotes.findMany`) liefern sonst still `undefined` statt zu
// scheitern. Modellnamen kommen aus dem generierten Client, damit neue Modelle
// ohne Pflege hier funktionieren.
const { Prisma } = jest.requireActual<typeof import("@prisma/client")>("@prisma/client");
const KNOWN_MODELS = new Set(
  Object.values(Prisma.ModelName).map((name) => name.charAt(0).toLowerCase() + name.slice(1)),
);
const KNOWN_MODEL_METHODS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);
const KNOWN_CLIENT_METHODS = new Set([
  "$transaction",
  "$queryRaw",
  "$queryRawUnsafe",
  "$executeRaw",
  "$executeRawUnsafe",
  "$connect",
  "$disconnect",
  "$on",
  "$extends",
]);

function createModelMock(model: string): Record<string, jest.Mock> {
  const methods: Record<string, jest.Mock> = {};
  return new Proxy(methods, {
    get(target, prop) {
      if (typeof prop !== "string" || BLOCKED_PROPS.has(prop)) {
        return Reflect.get(target, prop);
      }
      if (!KNOWN_MODEL_METHODS.has(prop)) {
        throw new Error(`prisma-mock: unbekannte Methode prisma.${model}.${prop}`);
      }
      if (!(prop in target)) {
        target[prop] = jest.fn();
      }
      return target[prop];
    },
  });
}

export function createPrismaMock(): PrismaMock {
  const models: Record<string, Record<string, jest.Mock>> = {};
  const clientMethods: Record<string, jest.Mock> = {};

  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string" || BLOCKED_PROPS.has(prop)) {
          return undefined;
        }
        if (prop.startsWith("$")) {
          if (!KNOWN_CLIENT_METHODS.has(prop)) {
            throw new Error(`prisma-mock: unbekannte Client-Methode prisma.${prop}`);
          }
          if (!clientMethods[prop]) {
            clientMethods[prop] =
              prop === "$transaction"
                ? jest.fn(async (arg: unknown) => {
                    if (typeof arg === "function") {
                      return (arg as (tx: unknown) => unknown)(proxy);
                    }
                    return Promise.all(arg as Array<Promise<unknown>>);
                  })
                : prop === "$queryRaw"
                  ? jest.fn(async () => [])
                  : jest.fn();
          }
          return clientMethods[prop];
        }
        if (!KNOWN_MODELS.has(prop)) {
          throw new Error(`prisma-mock: unbekanntes Modell prisma.${prop}`);
        }
        if (!models[prop]) {
          models[prop] = createModelMock(prop);
        }
        return models[prop];
      },
    },
  ) as PrismaMock;

  return proxy;
}

export const mockPrisma = createPrismaMock();

// Fertiges Modul-Objekt für die jest.mock-Factory.
export const prismaModuleMock = { prisma: mockPrisma };
