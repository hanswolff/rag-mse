jest.mock("@/lib/selftest/checks", () => ({
  getSelfTestChecks: jest.fn(),
}));

import { runCheck, runSelfTest } from "@/lib/selftest/runner";
import { getSelfTestChecks } from "@/lib/selftest/checks";
import type { RegisteredCheck } from "@/lib/selftest/types";

const mockGetChecks = getSelfTestChecks as jest.Mock;

describe("self-test runner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("runCheck", () => {
    it("returns the verdict and stamps a duration for a passing check", async () => {
      const check: RegisteredCheck = {
        name: "demo.ok",
        component: "Demo",
        run: async () => ({ status: "ok", message: "fine" }),
      };

      const result = await runCheck(check);

      expect(result.status).toBe("ok");
      expect(result.name).toBe("demo.ok");
      expect(result.component).toBe("Demo");
      expect(typeof result.durationMs).toBe("number");
    });

    it("converts a thrown error into an error result instead of propagating", async () => {
      const check: RegisteredCheck = {
        name: "demo.throws",
        component: "Demo",
        run: async () => {
          throw new Error("kaputt");
        },
      };

      const result = await runCheck(check);

      expect(result.status).toBe("error");
      expect(result.message).toBe("kaputt");
    });

    it("times out a hanging check and reports an error", async () => {
      const check: RegisteredCheck = {
        name: "demo.hangs",
        component: "Demo",
        timeoutMs: 30,
        run: () => new Promise((resolve) => setTimeout(() => resolve({ status: "ok" }), 500)),
      };

      const result = await runCheck(check);

      expect(result.status).toBe("error");
      expect(result.message).toMatch(/Zeitlimit/);
    });
  });

  describe("runSelfTest", () => {
    it("isolates a failing check so the others still run and aggregates to error", async () => {
      mockGetChecks.mockReturnValue([
        { name: "a.ok", component: "A", run: async () => ({ status: "ok" }) },
        {
          name: "b.boom",
          component: "B",
          run: async () => {
            throw new Error("b failed");
          },
        },
        { name: "c.warn", component: "C", run: async () => ({ status: "warn", message: "c warned" }) },
      ] satisfies RegisteredCheck[]);

      const report = await runSelfTest();

      expect(report.status).toBe("error");
      expect(report.checks).toHaveLength(3);
      expect(report.errors).toEqual([{ component: "B", message: "b failed" }]);
      expect(report.warnings).toEqual([{ component: "C", message: "c warned" }]);
    });

    it("aggregates to warn when there are warnings but no errors", async () => {
      mockGetChecks.mockReturnValue([
        { name: "a.ok", component: "A", run: async () => ({ status: "ok" }) },
        { name: "b.warn", component: "B", run: async () => ({ status: "warn", message: "w" }) },
      ] satisfies RegisteredCheck[]);

      const report = await runSelfTest();

      expect(report.status).toBe("warn");
      expect(report.errors).toHaveLength(0);
    });

    it("aggregates to ok when all checks pass or are skipped", async () => {
      mockGetChecks.mockReturnValue([
        { name: "a.ok", component: "A", run: async () => ({ status: "ok" }) },
        { name: "b.skip", component: "B", run: async () => ({ status: "skipped" }) },
      ] satisfies RegisteredCheck[]);

      const report = await runSelfTest();

      expect(report.status).toBe("ok");
    });
  });
});
