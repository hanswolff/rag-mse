import { withNewCorrelationId } from "@/lib/correlation-id";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { VERSION_INFO } from "@/lib/version-info";
import type { CheckResult, RegisteredCheck, SelfTestReport } from "./types";
import { getSelfTestChecks } from "./checks";

export const DEFAULT_CHECK_TIMEOUT_MS = 10_000;

class CheckTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Prüfung hat das Zeitlimit von ${timeoutMs} ms überschritten`);
    this.name = "CheckTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new CheckTimeoutError(timeoutMs)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Runs a single check in isolation. A check that throws or times out is converted into an
 * "error" result rather than being allowed to bubble up, so one failing check can never crash
 * the whole report or affect the others.
 */
export async function runCheck(check: RegisteredCheck): Promise<CheckResult> {
  const timeoutMs = check.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS;
  const start = Date.now();

  try {
    const verdict = await withTimeout(check.run(), timeoutMs);
    return {
      name: check.name,
      component: check.component,
      status: verdict.status,
      message: verdict.message,
      durationMs: Date.now() - start,
      details: verdict.details,
    };
  } catch (error: unknown) {
    return {
      name: check.name,
      component: check.component,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
    };
  }
}

function aggregateStatus(checks: CheckResult[]): SelfTestReport["status"] {
  if (checks.some((c) => c.status === "error")) {
    return "error";
  }
  if (checks.some((c) => c.status === "warn")) {
    return "warn";
  }
  return "ok";
}

export async function runSelfTest(): Promise<SelfTestReport> {
  return withNewCorrelationId(async () => {
    const start = Date.now();
    const checks = await Promise.all(getSelfTestChecks().map((check) => runCheck(check)));

    const warnings = checks
      .filter((c) => c.status === "warn")
      .map((c) => ({ component: c.component, message: c.message ?? c.name }));
    const errors = checks
      .filter((c) => c.status === "error")
      .map((c) => ({ component: c.component, message: c.message ?? c.name }));

    const status = aggregateStatus(checks);

    const report: SelfTestReport = {
      status,
      timestamp: new Date().toISOString(),
      version: VERSION_INFO.version,
      durationMs: Date.now() - start,
      checks,
      warnings,
      errors,
    };

    if (status === "error") {
      logError("selftest_failed", "Self-test reported errors", {
        errorCount: errors.length,
        warningCount: warnings.length,
        components: errors.map((e) => e.component),
      });
    } else if (status === "warn") {
      logWarn("selftest_degraded", "Self-test reported warnings", {
        warningCount: warnings.length,
        components: warnings.map((w) => w.component),
      });
    } else {
      logInfo("selftest_ok", "Self-test passed", { checkCount: checks.length });
    }

    return report;
  });
}
