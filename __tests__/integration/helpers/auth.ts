import { getServerSession } from "next-auth";

export interface SessionUserLike {
  id: string;
  email: string;
  name?: string | null;
  role: string;
}

// Setzt die (gemockte) NextAuth-Session auf einen echten Datenbank-Benutzer.
// Alles hinter der Session — Rollenprüfung, Prisma-Zugriffe — läuft real.
export function loginAs(user: SessionUserLike): void {
  jest.mocked(getServerSession).mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? "Testbenutzer",
      role: user.role,
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  } as never);
}

export function logout(): void {
  jest.mocked(getServerSession).mockResolvedValue(null);
}
