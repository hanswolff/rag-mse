/**
 * Zentraler Mock für @/lib/logger — deckt ALLE Exporte des echten Moduls ab.
 *
 * Verwendung im Testfile:
 *
 *   import { mockLogger } from "./helpers/logger-mock";
 *   jest.mock("@/lib/logger", () => mockLogger);
 *
 * maskEmail/maskToken sind Identitätsfunktionen (die Mehrheitsvariante der
 * früheren Handmocks); Tests, die eine andere Maskierung brauchen, setzen
 * lokal `mockLogger.maskToken.mockImplementation(...)`.
 * `jest.clearAllMocks()` lässt die Identitäts-Implementierungen intakt.
 */
export const mockLogger = {
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logResourceNotFound: jest.fn(),
  logValidationFailure: jest.fn(),
  maskEmail: jest.fn((email: string | null | undefined) => email),
  maskToken: jest.fn((token: string) => token),
};
