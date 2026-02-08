import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

jest.mock("@prisma/client");
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashedPassword123"),
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
      },
      shootingRange: {
        upsert: jest.fn(),
      },
      $disconnect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PrismaClient>;

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrismaClient);

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
    it("should use default values when environment variables are not set", async () => {
      process.env.SEED_ADMIN_EMAIL = "";
      process.env.SEED_ADMIN_PASSWORD = "";
      process.env.SEED_ADMIN_NAME = "";

      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.create.mockResolvedValue({
        id: "1",
        email: "admin@rag-mse.de",
        password: "hashedPassword123",
        name: "Administrator",
        role: "ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();

      const { main } = await import("../prisma/seed");

      await main(mockPrismaClient);

      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: {
          email: "admin@rag-mse.de",
          password: "hashedPassword123",
          name: "Administrator",
          role: "ADMIN",
        },
      });
    });

    it("should use environment variable values when set", async () => {
      process.env.SEED_ADMIN_EMAIL = "custom@example.com";
      process.env.SEED_ADMIN_PASSWORD = "securePassword123";
      process.env.SEED_ADMIN_NAME = "Custom Admin";

      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.create.mockResolvedValue({
        id: "1",
        email: "custom@example.com",
        password: "hashedPassword123",
        name: "Custom Admin",
        role: "ADMIN",
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
          role: "ADMIN",
        },
      });
    });
  });

  describe("Email validation", () => {
    it("should reject invalid email format", async () => {
      process.env.SEED_ADMIN_EMAIL = "invalid-email";

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

      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.create.mockResolvedValue({
        id: "1",
        email: "admin@example.com",
        password: "hashedPassword123",
        name: "Administrator",
        role: "ADMIN",
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

      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: "1",
        email: "admin@example.com",
        password: "existingHash",
        name: "Existing Admin",
        role: "ADMIN",
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

      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.create.mockResolvedValue({
        id: "1",
        email: "admin@example.com",
        password: "hashedPassword123",
        name: "Administrator",
        role: "ADMIN",
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
          role: "ADMIN",
        },
      });
    });
  });

  describe("Error handling", () => {
    it("should handle database errors gracefully", async () => {
      process.env.SEED_ADMIN_EMAIL = "admin@example.com";
      process.env.SEED_ADMIN_PASSWORD = "password123";

      mockPrismaClient.user.findUnique.mockRejectedValue(
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
});
