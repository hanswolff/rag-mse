export class RateLimitError extends Error {
  constructor(public blockedMinutes: number) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
  }
}

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Rate limit service unavailable");
    this.name = "RateLimitUnavailableError";
  }
}

export class TokenRateLimitUnavailableError extends Error {
  constructor() {
    super("Token rate limit service unavailable");
    this.name = "TokenRateLimitUnavailableError";
  }
}

export class LoginProofUnavailableError extends Error {
  constructor() {
    super("Login proof service unavailable");
    this.name = "LoginProofUnavailableError";
  }
}

export class InvitationNotFoundError extends Error {
  constructor() {
    super("Invitation not found");
    this.name = "InvitationNotFoundError";
  }
}

export class InvitationAlreadyUsedError extends Error {
  constructor() {
    super("Invitation already used");
    this.name = "InvitationAlreadyUsedError";
  }
}

export class InvitationExpiredError extends Error {
  constructor() {
    super("Invitation expired");
    this.name = "InvitationExpiredError";
  }
}

export class UserNotFoundInTransactionError extends Error {
  constructor() {
    super("User not found in transaction");
    this.name = "UserNotFoundInTransactionError";
  }
}

export class LastAdminDemotionBlockedError extends Error {
  constructor() {
    super("Last admin demotion blocked");
    this.name = "LastAdminDemotionBlockedError";
  }
}

export class LastAdminDeleteBlockedError extends Error {
  constructor() {
    super("Last admin delete blocked");
    this.name = "LastAdminDeleteBlockedError";
  }
}
