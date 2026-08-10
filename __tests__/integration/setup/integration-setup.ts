import { rmSync } from "fs";
import { getServerSession } from "next-auth";
import { resetRateLimitStore } from "@/lib/rate-limit-store";

// NextAuth ist neben SMTP und Systemzeit die einzige gemockte Systemgrenze
// dieser Schicht (ADR 0010): ersetzt wird nur die Session-Beschaffung —
// Rollen- und Rechtelogik, Prisma und next/server laufen real.
jest.mock("next-auth", () => ({
  __esModule: true,
  default: jest.fn(),
  getServerSession: jest.fn(),
}));

beforeEach(() => {
  jest.mocked(getServerSession).mockReset();
  jest.mocked(getServerSession).mockResolvedValue(null);
  // Login-/Token-Routen teilen sich einen prozessweiten Rate-Limit-Store.
  resetRateLimitStore();
});

afterAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();

  const tempDir = process.env.RAG_MSE_INTEGRATION_TMP_DIR;
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
