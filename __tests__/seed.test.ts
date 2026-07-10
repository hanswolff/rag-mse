import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { rename } from "node:fs/promises";
import { adoptAusschreibungFile } from "../lib/ausschreibung-storage";

jest.mock("@prisma/client");
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashedPassword123"),
}));
jest.mock("../lib/ausschreibung-storage", () => ({
  adoptAusschreibungFile: jest.fn(),
}));
jest.mock("node:fs/promises", () => ({
  stat: jest.fn().mockResolvedValue({ size: 12345 }),
  rename: jest.fn().mockResolvedValue(undefined),
}));

describe("Seed Script", () => {
  let mockPrismaClient: jest.Mocked<PrismaClient>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();

    originalEnv = process.env;

    mockPrismaClient = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      shootingRange: {
        upsert: jest.fn(),
      },
      ausschreibung: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      $disconnect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PrismaClient>;

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrismaClient);
    (adoptAusschreibungFile as jest.Mock).mockResolvedValue(null);

    process.env = {
      ...originalEnv,
      SEED_ADMIN_EMAIL: "",
      SEED_ADMIN_PASSWORD: "",
      SEED_ADMIN_NAME: "",
    };

    jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit was called");
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Environment variable handling", () => {
    it("should skip admin seeding when environment variables are not set", async () => {
      process.env.SEED_ADMIN_EMAIL = "";
      process.env.SEED_ADMIN_PASSWORD = "";
      process.env.SEED_ADMIN_NAME = "";

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "warn").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      await main(mockPrismaClient);

      expect(mockPrismaClient.user.create).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set")
      );
    });

    it("should use environment variable values when set", async () => {
      process.env.SEED_ADMIN_EMAIL = "custom@example.com";
      process.env.SEED_ADMIN_PASSWORD = "securePassword123";
      process.env.SEED_ADMIN_NAME = "Custom Admin";

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrismaClient.user.create as jest.Mock).mockResolvedValue({
        id: "1",
        email: "custom@example.com",
        password: "hashedPassword123",
        name: "Custom Admin",
        role: "SITE_ADMINISTRATOR",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      await main(mockPrismaClient);

      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: {
          email: "custom@example.com",
          password: "hashedPassword123",
          name: "Custom Admin",
          role: "SITE_ADMINISTRATOR",
        },
      });
    });
  });

  describe("Email validation", () => {
    it("should reject invalid email format", async () => {
      process.env.SEED_ADMIN_EMAIL = "invalid-email";
      process.env.SEED_ADMIN_PASSWORD = "Password123";

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      const result = main();

      await expect(result).rejects.toThrow(
        "Invalid email format: invalid-email"
      );
    });
  });

  describe("Password validation", () => {
    it("should reject password less than 8 characters", async () => {
      process.env.SEED_ADMIN_EMAIL = "admin@example.com";
      process.env.SEED_ADMIN_PASSWORD = "short1";

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      const result = main();

      await expect(result).rejects.toThrow(
        "Passwort muss mindestens 8 Zeichen lang sein"
      );
    });

    it("should reject password without uppercase letter", async () => {
      process.env.SEED_ADMIN_EMAIL = "admin@example.com";
      process.env.SEED_ADMIN_PASSWORD = "password1";

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      const result = main();

      await expect(result).rejects.toThrow(
        "Passwort muss mindestens einen Großbuchstaben enthalten"
      );
    });

    it("should reject password without lowercase letter", async () => {
      process.env.SEED_ADMIN_EMAIL = "admin@example.com";
      process.env.SEED_ADMIN_PASSWORD = "PASSWORD1";

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      const result = main();

      await expect(result).rejects.toThrow(
        "Passwort muss mindestens einen Kleinbuchstaben enthalten"
      );
    });

    it("should reject password without digit", async () => {
      process.env.SEED_ADMIN_EMAIL = "admin@example.com";
      process.env.SEED_ADMIN_PASSWORD = "Password";

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      const result = main();

      await expect(result).rejects.toThrow(
        "Passwort muss mindestens eine Ziffer enthalten"
      );
    });

    it("should accept valid password with all requirements", async () => {
      process.env.SEED_ADMIN_EMAIL = "admin@example.com";
      process.env.SEED_ADMIN_PASSWORD = "Password1";

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrismaClient.user.create as jest.Mock).mockResolvedValue({
        id: "1",
        email: "admin@example.com",
        password: "hashedPassword123",
        name: "Administrator",
        role: "SITE_ADMINISTRATOR",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      await expect(main(mockPrismaClient)).resolves.not.toThrow();
      expect(mockPrismaClient.user.create).toHaveBeenCalled();
    });
  });

  describe("Existing admin user handling", () => {
    it("should skip creation if admin user already exists", async () => {
      process.env.SEED_ADMIN_EMAIL = "admin@example.com";
      process.env.SEED_ADMIN_PASSWORD = "Password123";

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue({
        id: "1",
        email: "admin@example.com",
        password: "existingHash",
        name: "Existing Admin",
        role: "SITE_ADMINISTRATOR",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      await main(mockPrismaClient);

      expect(mockPrismaClient.user.create).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("already exists")
      );
    });
  });

  describe("Password hashing", () => {
    beforeEach(() => {
      (hash as jest.Mock).mockClear();
    });

    it("should hash password with correct salt rounds", async () => {
      process.env.SEED_ADMIN_EMAIL = "admin@example.com";
      process.env.SEED_ADMIN_PASSWORD = "Password123";

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrismaClient.user.create as jest.Mock).mockResolvedValue({
        id: "1",
        email: "admin@example.com",
        password: "hashedPassword123",
        name: "Administrator",
        role: "SITE_ADMINISTRATOR",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      await main(mockPrismaClient);

      expect(hash).toHaveBeenCalledWith("Password123", 10);
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: {
          email: "admin@example.com",
          password: "hashedPassword123",
          name: "Administrator",
          role: "SITE_ADMINISTRATOR",
        },
      });
    });
  });

  describe("Error handling", () => {
    it("should handle database errors gracefully", async () => {
      process.env.SEED_ADMIN_EMAIL = "admin@example.com";
      process.env.SEED_ADMIN_PASSWORD = "password123";

      (mockPrismaClient.user.findUnique as jest.Mock).mockRejectedValue(
        new Error("Database connection failed")
      );

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      try {
        await main();
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });

  describe("Ausschreibung seed (Landesmeisterschaft)", () => {
    it("skips seeding when an ausschreibung with the same title already exists", async () => {
      (mockPrismaClient.ausschreibung.findFirst as jest.Mock).mockResolvedValue({
        id: "existing-1",
        title: "Landesmeisterschaft Schießsport",
      });

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "warn").mockImplementation();

      const { main } = await import("../prisma/seed");
      await main(mockPrismaClient);

      expect(adoptAusschreibungFile).not.toHaveBeenCalled();
      expect(mockPrismaClient.ausschreibung.create).not.toHaveBeenCalled();
    });

    it("skips seeding without error when the source PDF is missing", async () => {
      (mockPrismaClient.ausschreibung.findFirst as jest.Mock).mockResolvedValue(null);
      (adoptAusschreibungFile as jest.Mock).mockResolvedValue(null);

      jest.spyOn(console, "log").mockImplementation();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      const { main } = await import("../prisma/seed");
      await main(mockPrismaClient);

      expect(mockPrismaClient.ausschreibung.create).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Quelldatei"));
    });

    it("adopts the source PDF and creates the ausschreibung record when not yet seeded", async () => {
      (mockPrismaClient.ausschreibung.findFirst as jest.Mock).mockResolvedValue(null);
      (adoptAusschreibungFile as jest.Mock).mockResolvedValue({
        storedFileName: "generated123.pdf",
        filePath: "/data/ausschreibungen/generated123.pdf",
      });
      (mockPrismaClient.ausschreibung.create as jest.Mock).mockResolvedValue({ id: "new-1" });

      jest.spyOn(console, "log").mockImplementation();

      const { main } = await import("../prisma/seed");
      await main(mockPrismaClient);

      expect(mockPrismaClient.ausschreibung.create).toHaveBeenCalledWith({
        data: {
          title: "Landesmeisterschaft Schießsport",
          expiresAt: new Date(Date.UTC(2026, 7, 1)),
          originalFileName: "2026-08-01_Ausschreibung_Landesmeisterschaft_Schießsport.pdf",
          storedFileName: "generated123.pdf",
          mimeType: "application/pdf",
          sizeBytes: 12345,
        },
      });
    });

    it("moves the adopted file back to its source path when the DB create fails", async () => {
      (mockPrismaClient.ausschreibung.findFirst as jest.Mock).mockResolvedValue(null);
      (adoptAusschreibungFile as jest.Mock).mockResolvedValue({
        storedFileName: "generated123.pdf",
        filePath: "/data/ausschreibungen/generated123.pdf",
      });
      (mockPrismaClient.ausschreibung.create as jest.Mock).mockRejectedValue(new Error("DB unavailable"));

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      await expect(main(mockPrismaClient)).rejects.toThrow("DB unavailable");

      expect(rename).toHaveBeenCalledWith(
        "/data/ausschreibungen/generated123.pdf",
        expect.stringContaining("2026-08-01_Ausschreibung_Landesmeisterschaft_Schießsport.pdf")
      );
    });
  });
});
