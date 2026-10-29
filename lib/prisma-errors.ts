import { Prisma } from "@prisma/client";

/**
 * Robuste Doppel-Prüfung: instanceof greift im Normalbetrieb; die
 * Duck-Typing-Variante fängt Fälle ab, in denen der Fehler nicht aus derselben
 * Prisma-Client-Instanz stammt (z. B. gemockter Client in Tests).
 */
export function isPrismaErrorCode(error: unknown, code: string): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === code;
  }

  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === code
  );
}

export function isUniqueConstraintError(error: unknown): boolean {
  return isPrismaErrorCode(error, "P2002");
}
