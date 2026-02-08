import crypto from "crypto";

export function generateRandomBytes(length: number, encoding: "hex" | "base64" = "hex"): string {
  return crypto.randomBytes(length).toString(encoding);
}

export function generateRandomToken(): string {
  return generateRandomBytes(32, "hex");
}

export function generateRandomPassword(): string {
  return generateRandomBytes(16, "base64");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
