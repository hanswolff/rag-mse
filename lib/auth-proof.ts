import crypto from "node:crypto";
import { LoginProofUnavailableError } from "./errors";

interface LoginProof {
  version: 1;
  email: string;
  clientIp: string;
  passwordDigest: string;
  expiresAt: number;
}

interface ImpersonationProof {
  version: 1;
  action: "start" | "stop";
  actorUserId: string;
  targetUserId?: string;
  effectiveUserId?: string;
  expiresAt: number;
}

const LOGIN_PROOF_TTL_MS = 60_000;
const LOGIN_PROOF_VERSION = "v1";
const IMPERSONATION_PROOF_TTL_MS = 60_000;
const IMPERSONATION_PROOF_VERSION = "v1i";
const PASSWORD_CHANGE_PROOF_TTL_MS = 60_000;
const PASSWORD_CHANGE_PROOF_VERSION = "v1p";

interface PasswordChangeProof {
  version: 1;
  userId: string;
  passwordUpdatedAt: number;
  expiresAt: number;
}

// Mit NEXTAUTH_SECRET geschlüsselt statt blankem SHA-256: Der Proof geht an den
// Browser, ein ungesalzener Passwort-Hash darin wäre offline knackbar. Die Bindung
// an genau dieses Passwort bleibt erhalten — sie erlaubt dem Proof, die erneute
// Passwortprüfung zu ersetzen.
function hashLoginPassword(password: string, secret: string): string {
  return crypto.createHmac("sha256", `${secret}:login-proof`).update(password).digest("hex");
}

function getLoginProofSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new LoginProofUnavailableError();
  }
  return secret;
}

function signLoginProof(payloadSegment: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadSegment).digest("base64url");
}

function verifyLoginProofSignature(payloadSegment: string, signatureSegment: string, secret: string): boolean {
  const expected = Buffer.from(signLoginProof(payloadSegment, secret));
  const actual = Buffer.from(signatureSegment);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function createLoginProof(email: string, clientIp: string, password: string): string {
  const secret = getLoginProofSecret();
  const payload: LoginProof = {
    version: 1,
    email: email.toLowerCase(),
    clientIp,
    passwordDigest: hashLoginPassword(password, secret),
    expiresAt: Date.now() + LOGIN_PROOF_TTL_MS,
  };

  const payloadSegment = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signatureSegment = signLoginProof(payloadSegment, secret);
  return `${LOGIN_PROOF_VERSION}.${payloadSegment}.${signatureSegment}`;
}

function createSignedProof(versionPrefix: string, payload: object): string {
  const secret = getLoginProofSecret();
  const payloadSegment = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signatureSegment = signLoginProof(payloadSegment, secret);
  return `${versionPrefix}.${payloadSegment}.${signatureSegment}`;
}

function createSignedImpersonationProof(payload: ImpersonationProof): string {
  return createSignedProof(IMPERSONATION_PROOF_VERSION, payload);
}

function parseAndValidateImpersonationProof(token: string): ImpersonationProof | null {
  return parseAndValidateSignedProof<ImpersonationProof>(token, IMPERSONATION_PROOF_VERSION);
}

function parseAndValidateSignedProof<T extends { version: number; expiresAt: number }>(
  token: string,
  versionPrefix: string
): T | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== versionPrefix) {
    return null;
  }

  const [, payloadSegment, signatureSegment] = parts;
  let secret = "";
  try {
    secret = getLoginProofSecret();
  } catch {
    return null;
  }

  if (!verifyLoginProofSignature(payloadSegment, signatureSegment, secret)) {
    return null;
  }

  let payload: T | null = null;
  try {
    payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }

  if (!payload || payload.version !== 1 || payload.expiresAt <= Date.now()) {
    return null;
  }

  return payload;
}

export function createImpersonationStartProof(actorUserId: string, targetUserId: string): string {
  return createSignedImpersonationProof({
    version: 1,
    action: "start",
    actorUserId,
    targetUserId,
    expiresAt: Date.now() + IMPERSONATION_PROOF_TTL_MS,
  });
}

export function createImpersonationStopProof(actorUserId: string, effectiveUserId: string): string {
  return createSignedImpersonationProof({
    version: 1,
    action: "stop",
    actorUserId,
    effectiveUserId,
    expiresAt: Date.now() + IMPERSONATION_PROOF_TTL_MS,
  });
}

export function verifyImpersonationStartProof(token: string, actorUserId: string): { targetUserId: string } | null {
  const payload = parseAndValidateImpersonationProof(token);
  if (
    !payload
    || payload.action !== "start"
    || payload.actorUserId !== actorUserId
    || !payload.targetUserId
  ) {
    return null;
  }

  return { targetUserId: payload.targetUserId };
}

export function verifyImpersonationStopProof(token: string, actorUserId: string, effectiveUserId: string): boolean {
  const payload = parseAndValidateImpersonationProof(token);
  if (
    !payload
    || payload.action !== "stop"
    || payload.actorUserId !== actorUserId
    || payload.effectiveUserId !== effectiveUserId
  ) {
    return false;
  }

  return true;
}

export function createPasswordChangeProof(userId: string, passwordUpdatedAt: number): string {
  const payload: PasswordChangeProof = {
    version: 1,
    userId,
    passwordUpdatedAt,
    expiresAt: Date.now() + PASSWORD_CHANGE_PROOF_TTL_MS,
  };
  return createSignedProof(PASSWORD_CHANGE_PROOF_VERSION, payload);
}

export function verifyPasswordChangeProof(token: string, userId: string, passwordUpdatedAt: number | null): boolean {
  const payload = parseAndValidateSignedProof<PasswordChangeProof>(token, PASSWORD_CHANGE_PROOF_VERSION);
  return Boolean(
    payload
    && passwordUpdatedAt !== null
    && payload.userId === userId
    && payload.passwordUpdatedAt === passwordUpdatedAt
  );
}

export function validateLoginProof(token: string, email: string, clientIp: string, password: string): boolean {
  if (!token) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== LOGIN_PROOF_VERSION) {
    return false;
  }

  const [, payloadSegment, signatureSegment] = parts;
  let secret = "";
  try {
    secret = getLoginProofSecret();
  } catch {
    return false;
  }

  if (!verifyLoginProofSignature(payloadSegment, signatureSegment, secret)) {
    return false;
  }

  let payload: LoginProof | null = null;
  try {
    payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as LoginProof;
  } catch {
    return false;
  }

  if (!payload || payload.version !== 1) {
    return false;
  }

  const expectedDigest = hashLoginPassword(password, secret);
  const digestMatches =
    typeof payload.passwordDigest === "string"
    && payload.passwordDigest.length === expectedDigest.length
    && crypto.timingSafeEqual(Buffer.from(payload.passwordDigest), Buffer.from(expectedDigest));

  return (
    payload.email === email.toLowerCase()
    && payload.clientIp === clientIp
    && digestMatches
    && payload.expiresAt > Date.now()
  );
}
