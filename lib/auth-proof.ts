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

function hashLoginPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
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
  const expected = signLoginProof(payloadSegment, secret);
  if (expected.length !== signatureSegment.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureSegment));
}

export function createLoginProof(email: string, clientIp: string, password: string): string {
  const secret = getLoginProofSecret();
  const payload: LoginProof = {
    version: 1,
    email: email.toLowerCase(),
    clientIp,
    passwordDigest: hashLoginPassword(password),
    expiresAt: Date.now() + LOGIN_PROOF_TTL_MS,
  };

  const payloadSegment = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signatureSegment = signLoginProof(payloadSegment, secret);
  return `${LOGIN_PROOF_VERSION}.${payloadSegment}.${signatureSegment}`;
}

function createSignedImpersonationProof(payload: ImpersonationProof): string {
  const secret = getLoginProofSecret();
  const payloadSegment = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signatureSegment = signLoginProof(payloadSegment, secret);
  return `${IMPERSONATION_PROOF_VERSION}.${payloadSegment}.${signatureSegment}`;
}

function parseAndValidateImpersonationProof(token: string): ImpersonationProof | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== IMPERSONATION_PROOF_VERSION) {
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

  let payload: ImpersonationProof | null = null;
  try {
    payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as ImpersonationProof;
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

  return (
    payload.email === email.toLowerCase()
    && payload.clientIp === clientIp
    && payload.passwordDigest === hashLoginPassword(password)
    && payload.expiresAt > Date.now()
  );
}
