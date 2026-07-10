export type CheckStatus = "ok" | "warn" | "error" | "skipped";

export interface CheckResult {
  /** Stable machine-readable identifier, e.g. "database.connectivity". */
  name: string;
  /** Human-readable subsystem ("part of the application"), e.g. "Datenbank". */
  component: string;
  status: CheckStatus;
  /** Human-readable message (German, to match the rest of the codebase). */
  message?: string;
  /** Wall-clock duration of the check in milliseconds. */
  durationMs: number;
  /** Safe, non-sensitive extra information. Never include secrets. */
  details?: Record<string, unknown>;
}

/** The verdict a check produces. The runner adds name/component/durationMs. */
export interface CheckVerdict {
  status: CheckStatus;
  message?: string;
  details?: Record<string, unknown>;
}

export type CheckFn = () => Promise<CheckVerdict>;

export interface RegisteredCheck {
  name: string;
  component: string;
  /** Optional per-check timeout. Defaults to DEFAULT_CHECK_TIMEOUT_MS in the runner. */
  timeoutMs?: number;
  run: CheckFn;
}

export interface SelfTestIssue {
  component: string;
  message: string;
}

export interface SelfTestReport {
  status: "ok" | "warn" | "error";
  timestamp: string;
  version: string;
  durationMs: number;
  checks: CheckResult[];
  warnings: SelfTestIssue[];
  errors: SelfTestIssue[];
}
