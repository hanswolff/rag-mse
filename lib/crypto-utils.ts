import crypto from "crypto";

const BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateRandomBytes(length: number, encoding: "hex" | "base64" = "hex"): string {
  return crypto.randomBytes(length).toString(encoding);
}

export function generateRandomToken(length = 10): string {
  // Generate random bytes and convert to base62
  // We generate extra bytes to have enough entropy for the full length
  const bytesNeeded = Math.ceil((length * 6) / 8) + 4;
  const randomBytes = crypto.randomBytes(bytesNeeded);

  let result = "";
  let num = BigInt(0);

  // Convert bytes to a big integer
  for (let i = 0; i < randomBytes.length; i++) {
    num = (num << BigInt(8)) | BigInt(randomBytes[i]);
  }

  // Convert to base62
  const base = BigInt(62);
  while (result.length < length && num > BigInt(0)) {
    const remainder = Number(num % base);
    result = BASE62_CHARS[remainder] + result;
    num = num / base;
  }

  // Pad with additional random chars if needed
  while (result.length < length) {
    const randomIndex = randomBytes[result.length] % 62;
    result = BASE62_CHARS[randomIndex] + result;
  }

  return result;
}

export function generateRandomPassword(): string {
  return generateRandomBytes(16, "base64");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
