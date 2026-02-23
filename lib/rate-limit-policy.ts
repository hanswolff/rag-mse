export function shouldFailOpenOnRateLimiterError(): boolean {
  const configured = process.env.RATE_LIMIT_FAIL_OPEN;
  if (configured === "true") {
    return true;
  }
  if (configured === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

