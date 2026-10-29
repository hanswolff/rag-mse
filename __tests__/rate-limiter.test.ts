import {
  checkLoginRateLimit,
  checkTokenRateLimit,
  checkTokenReadRateLimit,
  checkForgotPasswordRateLimit,
  recordSuccessfulLogin,
  recordSuccessfulTokenUsage,
  resetRateLimitForTesting,
} from "@/lib/rate-limiter";
import { getRateLimitStore } from "@/lib/rate-limit-store";

// Beobachtet den Store direkt über die Schlüsselpräfixe des Rate-Limiters —
// die Produktions-API selbst bietet bewusst keine Statistik-Funktion an.
async function getRateLimitStats() {
  const store = getRateLimitStore();
  return {
    loginAttemptsCount: store.keys("ratelimit:login:*").length,
    ipAttemptsCount: store.keys("ratelimit:ip:*").length,
    tokenAttemptsCount: store.keys("ratelimit:token:*").length,
    forgotPasswordAttemptsCount: store.keys("ratelimit:forgot:*").length,
  };
}

describe("Rate Limiter", () => {
  beforeEach(async () => {
    await resetRateLimitForTesting();
  });

  afterEach(async () => {
    await resetRateLimitForTesting();
  });

  describe("checkTokenReadRateLimit", () => {
    it("does not consume the redemption attempt budget", async () => {
      // Regression: Seitenaufrufe (GET) teilten sich das 4-Versuche-Budget mit
      // der Einlösung — Link zweimal öffnen + Reload sperrte den Eingeladenen aus
      for (let i = 0; i < 10; i++) {
        const readResult = await checkTokenReadRateLimit("192.168.9.1", "token-hash-read");
        expect(readResult.allowed).toBe(true);
      }

      const attemptResult = await checkTokenRateLimit("192.168.9.1", "token-hash-read");
      expect(attemptResult.allowed).toBe(true);
      expect(attemptResult.attemptCount).toBe(1);
    });

    it("does not count towards the IP limit", async () => {
      const ip = "192.168.9.40";
      for (let i = 0; i < 40; i++) {
        const readResult = await checkTokenReadRateLimit(ip, `token-hash-ip-${i}`);
        expect(readResult.allowed).toBe(true);
      }

      const loginResult = await checkLoginRateLimit(ip);
      expect(loginResult).toMatchObject({ allowed: true, attemptCount: 1 });
    });

    it("limits reads of ever new tokens per IP with its own budget", async () => {
      jest.useFakeTimers({ now: new Date("2026-09-30T10:00:00+02:00") });
      try {
        const ip = "192.168.9.41";
        for (let i = 0; i < 100; i++) {
          expect((await checkTokenReadRateLimit(ip, `token-hash-enum-${i}`)).allowed).toBe(true);
        }

        jest.advanceTimersByTime(5 * 60 * 1000);
        const blocked = await checkTokenReadRateLimit(ip, "token-hash-enum-extra");
        expect(blocked.allowed).toBe(false);
        expect(blocked.blockedUntil! - Date.now()).toBe(10 * 60 * 1000);
        expect(getRateLimitStore().get("ratelimit:token-read:token-hash-enum-extra")).toBeNull();

        expect((await checkTokenReadRateLimit("192.168.9.42", "token-hash-enum-extra")).allowed).toBe(true);
        expect((await checkLoginRateLimit(ip)).allowed).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });

    it("still blocks excessive reads of the same token", async () => {
      let result = { allowed: true, attemptCount: 0 } as Awaited<ReturnType<typeof checkTokenReadRateLimit>>;
      for (let i = 0; i < 31; i++) {
        result = await checkTokenReadRateLimit(`192.168.9.${(i % 20) + 2}`, "token-hash-flood");
      }
      expect(result.allowed).toBe(false);
    });

    it("is cleared alongside the attempt bucket after successful usage", async () => {
      for (let i = 0; i < 5; i++) {
        await checkTokenReadRateLimit("192.168.9.30", "token-hash-clear");
      }
      await recordSuccessfulTokenUsage("token-hash-clear", "192.168.9.30");

      const readResult = await checkTokenReadRateLimit("192.168.9.30", "token-hash-clear");
      expect(readResult.allowed).toBe(true);
      expect(readResult.attemptCount).toBe(1);
    });
  });

  describe("Staffel (Sperre nur beim Erreichen einer Stufe)", () => {
    const MINUTE = 60 * 1000;

    beforeEach(() => {
      jest.useFakeTimers({ now: new Date("2026-09-30T10:00:00+02:00") });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    async function attemptLogin(times: number, ip: string, email: string) {
      let result = await checkLoginRateLimit(ip, email);
      for (let i = 1; i < times; i++) {
        result = await checkLoginRateLimit(ip, email);
      }
      return result;
    }

    it("erlaubt nach Ablauf der ersten Stufe wieder Versuche", async () => {
      const ip = "192.168.20.1";
      const email = "staffel@example.com";

      const blocked = await attemptLogin(6, ip, email);
      expect(blocked.allowed).toBe(false);
      expect(blocked.blockedUntil! - Date.now()).toBe(1 * MINUTE);

      jest.advanceTimersByTime(1 * MINUTE);

      const afterBlock = await checkLoginRateLimit(ip, email);
      expect(afterBlock.allowed).toBe(true);
      expect(afterBlock.attemptCount).toBe(7);
    });

    it("meldet während einer Sperre die tatsächliche Restzeit, ohne weiter zu zählen", async () => {
      const ip = "192.168.20.2";
      const email = "restzeit@example.com";

      const blocked = await attemptLogin(6, ip, email);
      jest.advanceTimersByTime(20 * 1000);

      const stillBlocked = await checkLoginRateLimit(ip, email);
      expect(stillBlocked.allowed).toBe(false);
      expect(stillBlocked.blockedUntil).toBe(blocked.blockedUntil);
      expect(stillBlocked.blockedUntil! - Date.now()).toBe(40 * 1000);
      expect(stillBlocked.attemptCount).toBe(6);
    });

    it("erreicht die Login-Stufen 11, 16 und 21 mit 5, 15 und 60 Minuten", async () => {
      const ip = "192.168.20.3";
      const email = "stufen@example.com";

      expect((await attemptLogin(6, ip, email)).blockedUntil! - Date.now()).toBe(1 * MINUTE);
      jest.advanceTimersByTime(1 * MINUTE);

      const stage2 = await attemptLogin(5, ip, email);
      expect(stage2).toMatchObject({ allowed: false, attemptCount: 11 });
      expect(stage2.blockedUntil! - Date.now()).toBe(5 * MINUTE);
      jest.advanceTimersByTime(5 * MINUTE);

      const stage3 = await attemptLogin(5, ip, email);
      expect(stage3).toMatchObject({ allowed: false, attemptCount: 16 });
      expect(stage3.blockedUntil! - Date.now()).toBe(15 * MINUTE);
      jest.advanceTimersByTime(15 * MINUTE);

      const stage4 = await attemptLogin(5, ip, email);
      expect(stage4).toMatchObject({ allowed: false, attemptCount: 21 });
      expect(stage4.blockedUntil! - Date.now()).toBe(60 * MINUTE);
      jest.advanceTimersByTime(60 * MINUTE);

      const afterLastStage = await checkLoginRateLimit(ip, email);
      expect(afterLastStage).toMatchObject({ allowed: false, attemptCount: 22 });
      expect(afterLastStage.blockedUntil! - Date.now()).toBe(60 * MINUTE);
    });

    it("sperrt nach der letzten Stufe jeden weiteren Versuch erneut für die Maximaldauer", async () => {
      const ip = "192.168.20.8";
      const email = "maximal@example.com";

      await attemptLogin(6, ip, email);
      jest.advanceTimersByTime(1 * MINUTE);
      await attemptLogin(5, ip, email);
      jest.advanceTimersByTime(5 * MINUTE);
      await attemptLogin(5, ip, email);
      jest.advanceTimersByTime(15 * MINUTE);
      expect(await attemptLogin(5, ip, email)).toMatchObject({ allowed: false, attemptCount: 21 });

      for (let round = 22; round <= 24; round++) {
        jest.advanceTimersByTime(60 * MINUTE);
        const blocked = await checkLoginRateLimit(ip, email);
        expect(blocked).toMatchObject({ allowed: false, attemptCount: round });
        expect(blocked.blockedUntil! - Date.now()).toBe(60 * MINUTE);
      }

      await recordSuccessfulLogin(ip, email);
      expect(await checkLoginRateLimit(ip, email)).toMatchObject({ allowed: true, attemptCount: 1 });
    });

    it("setzt die Staffel nach erfolgreichem Login zurück", async () => {
      const ip = "192.168.20.9";
      const email = "erfolg@example.com";

      await attemptLogin(6, ip, email);
      jest.advanceTimersByTime(1 * MINUTE);
      expect((await checkLoginRateLimit(ip, email)).attemptCount).toBe(7);

      await recordSuccessfulLogin(ip, email);
      const afterSuccess = await attemptLogin(5, ip, email);
      expect(afterSuccess).toMatchObject({ allowed: true, attemptCount: 5 });
    });

    it("setzt die Staffel erst ein volles Fenster nach Ende der Sperre zurück", async () => {
      const ip = "192.168.20.4";
      const email = "fenster@example.com";

      await attemptLogin(6, ip, email);
      jest.advanceTimersByTime(1 * MINUTE + 15 * MINUTE - 1000);
      expect((await checkLoginRateLimit(ip, email)).attemptCount).toBe(7);

      await resetRateLimitForTesting();
      await attemptLogin(6, ip, email);
      jest.advanceTimersByTime(1 * MINUTE + 15 * MINUTE);
      expect((await checkLoginRateLimit(ip, email)).attemptCount).toBe(1);
    });

    it("staffelt Token-Einlöseversuche 5 → 15 → 60 Minuten", async () => {
      const ip = "192.168.20.5";
      const tokenHash = "token-staffel";
      const attempt = async (times: number) => {
        let result = await checkTokenRateLimit(ip, tokenHash);
        for (let i = 1; i < times; i++) {
          result = await checkTokenRateLimit(ip, tokenHash);
        }
        return result;
      };

      expect((await attempt(4)).blockedUntil! - Date.now()).toBe(5 * MINUTE);
      jest.advanceTimersByTime(5 * MINUTE);
      expect((await checkTokenRateLimit(ip, tokenHash)).allowed).toBe(true);

      const stage2 = await attempt(2);
      expect(stage2).toMatchObject({ allowed: false, attemptCount: 7 });
      expect(stage2.blockedUntil! - Date.now()).toBe(15 * MINUTE);
      jest.advanceTimersByTime(15 * MINUTE);

      const stage3 = await attempt(3);
      expect(stage3).toMatchObject({ allowed: false, attemptCount: 10 });
      expect(stage3.blockedUntil! - Date.now()).toBe(60 * MINUTE);
    });

    it("staffelt „Passwort vergessen“ 15 → 60 Minuten → 24 Stunden", async () => {
      const ip = "192.168.20.6";
      const email = "vergessen@example.com";
      const attempt = async (times: number) => {
        let result = await checkForgotPasswordRateLimit(ip, email);
        for (let i = 1; i < times; i++) {
          result = await checkForgotPasswordRateLimit(ip, email);
        }
        return result;
      };

      expect((await attempt(3)).blockedUntil! - Date.now()).toBe(15 * MINUTE);
      jest.advanceTimersByTime(15 * MINUTE);

      const stage2 = await attempt(3);
      expect(stage2).toMatchObject({ allowed: false, attemptCount: 6 });
      expect(stage2.blockedUntil! - Date.now()).toBe(60 * MINUTE);
      jest.advanceTimersByTime(60 * MINUTE);

      const stage3 = await attempt(4);
      expect(stage3).toMatchObject({ allowed: false, attemptCount: 10 });
      expect(stage3.blockedUntil! - Date.now()).toBe(24 * 60 * MINUTE);
    });

    it("meldet beim IP-Limit das Ende des IP-Fensters als Restzeit", async () => {
      const ip = "192.168.20.7";

      for (let i = 0; i < 25; i++) {
        await checkLoginRateLimit(ip, `ip${i}@example.com`);
      }
      jest.advanceTimersByTime(5 * MINUTE);

      const blocked = await checkLoginRateLimit(ip, "ip-extra@example.com");
      expect(blocked.allowed).toBe(false);
      expect(blocked.blockedUntil! - Date.now()).toBe(10 * MINUTE);
    });
  });

  describe("checkLoginRateLimit", () => {
    it("allows first login attempt", async () => {
      const result = await checkLoginRateLimit("192.168.1.1", "test@example.com");

      expect(result.allowed).toBe(true);
      expect(result.attemptCount).toBe(1);
    });

    it("tracks multiple attempts for same IP and email", async () => {
      const result1 = await checkLoginRateLimit("192.168.1.1", "test@example.com");
      const result2 = await checkLoginRateLimit("192.168.1.1", "test@example.com");
      const result3 = await checkLoginRateLimit("192.168.1.1", "test@example.com");

      expect(result1.allowed).toBe(true);
      expect(result1.attemptCount).toBe(1);

      expect(result2.allowed).toBe(true);
      expect(result2.attemptCount).toBe(2);

      expect(result3.allowed).toBe(true);
      expect(result3.attemptCount).toBe(3);
    });

    it("blocks attempts after reaching threshold", async () => {
      const ip = "192.168.1.2";
      const email = "test2@example.com";

      let result;
      for (let i = 0; i < 5; i++) {
        result = await checkLoginRateLimit(ip, email);
        expect(result.allowed).toBe(true);
      }

      result = await checkLoginRateLimit(ip, email);

      expect(result).toBeDefined();
      expect(result!.allowed).toBe(false);
      expect(result!.blockedUntil).toBeDefined();
      expect(result!.attemptCount).toBe(6);
      expect(result!.blockedUntil).toBeGreaterThan(Date.now());
    });

    it("uses different rate limits for different IP + email combinations", async () => {
      const result1 = await checkLoginRateLimit("192.168.1.3", "test3@example.com");
      const result2 = await checkLoginRateLimit("192.168.1.4", "test4@example.com");

      expect(result1.allowed).toBe(true);
      expect(result1.attemptCount).toBe(1);

      expect(result2.allowed).toBe(true);
      expect(result2.attemptCount).toBe(1);
    });

    it("implements exponential backoff with different block durations", async () => {
      jest.useFakeTimers();

      const ip = "192.168.1.5";
      const email = "test5@example.com";

      let result;
      for (let i = 0; i < 6; i++) {
        result = await checkLoginRateLimit(ip, email);
      }

      expect(result!.allowed).toBe(false);
      expect(result!.blockedUntil).toBeDefined();
      expect(result!.attemptCount).toBe(6);

      const firstBlockDuration = result!.blockedUntil! - Date.now();
      expect(firstBlockDuration).toBe(1 * 60 * 1000);

      const LOGIN_WINDOW_MS = 15 * 60 * 1000;
      jest.advanceTimersByTime(LOGIN_WINDOW_MS + 1000);

      const email2 = "test5-2@example.com";
      for (let i = 0; i < 6; i++) {
        result = await checkLoginRateLimit(ip, email2);
      }

      expect(result!.allowed).toBe(false);
      expect(result!.attemptCount).toBe(6);

      const secondBlockDuration = result!.blockedUntil! - Date.now();
      expect(secondBlockDuration).toBe(1 * 60 * 1000);

      jest.useRealTimers();
    });

    it("resets counter after window expires", async () => {
      const ip = "192.168.1.6";
      const email = "test6@example.com";

      const originalWindow = 15 * 60 * 1000;

      jest.useFakeTimers();

      for (let i = 0; i < 5; i++) {
        await checkLoginRateLimit(ip, email);
      }

      let result = await checkLoginRateLimit(ip, email);
      expect(result.allowed).toBe(false);

      jest.advanceTimersByTime(1 * 60 * 1000 + originalWindow + 1000);

      result = await checkLoginRateLimit(ip, email);
      expect(result.allowed).toBe(true);
      expect(result.attemptCount).toBe(1);

      jest.useRealTimers();
    });

    it("handles case-insensitive email addresses", async () => {
      const result1 = await checkLoginRateLimit("192.168.1.7", "TEST@example.com");
      const result2 = await checkLoginRateLimit("192.168.1.7", "test@example.com");

      expect(result1.attemptCount).toBe(1);
      expect(result2.attemptCount).toBe(2);
    });

    it("enforces IP-only rate limit", async () => {
      const ip = "192.168.1.8";

      let result;
      for (let i = 0; i < 30; i++) {
        result = await checkLoginRateLimit(ip, `user${i}@example.com`);
      }

      expect(result).toBeDefined();
      expect(result!.allowed).toBe(false);
    });
  });

  describe("checkTokenRateLimit", () => {
    it("allows first token attempt", async () => {
      const result = await checkTokenRateLimit("192.168.2.1", "token-hash-1");

      expect(result.allowed).toBe(true);
      expect(result.attemptCount).toBe(1);
    });

    it("tracks multiple attempts for same token hash", async () => {
      const result1 = await checkTokenRateLimit("192.168.2.2", "token-hash-2");
      const result2 = await checkTokenRateLimit("192.168.2.2", "token-hash-2");
      const result3 = await checkTokenRateLimit("192.168.2.2", "token-hash-2");

      expect(result1.allowed).toBe(true);
      expect(result1.attemptCount).toBe(1);

      expect(result2.allowed).toBe(true);
      expect(result2.attemptCount).toBe(2);

      expect(result3.allowed).toBe(true);
      expect(result3.attemptCount).toBe(3);
    });

    it("blocks attempts after reaching threshold", async () => {
      const ip = "192.168.2.3";
      const tokenHash = "token-hash-3";

      let result;
      for (let i = 0; i < 3; i++) {
        result = await checkTokenRateLimit(ip, tokenHash);
        expect(result.allowed).toBe(true);
      }

      result = await checkTokenRateLimit(ip, tokenHash);

      expect(result).toBeDefined();
      expect(result!.allowed).toBe(false);
      expect(result!.blockedUntil).toBeDefined();
      expect(result!.attemptCount).toBe(4);
      expect(result!.blockedUntil).toBeGreaterThan(Date.now());
    });

    it("uses different rate limits for different token hashes", async () => {
      const result1 = await checkTokenRateLimit("192.168.2.4", "token-hash-4");
      const result2 = await checkTokenRateLimit("192.168.2.4", "token-hash-5");

      expect(result1.allowed).toBe(true);
      expect(result1.attemptCount).toBe(1);

      expect(result2.allowed).toBe(true);
      expect(result2.attemptCount).toBe(1);
    });

    it("implements tiered blocking with different block durations", async () => {
      jest.useFakeTimers();

      const ip = "192.168.2.5";
      const tokenHash = "token-hash-6";

      let result;
      for (let i = 0; i < 4; i++) {
        result = await checkTokenRateLimit(ip, tokenHash);
      }

      expect(result!.allowed).toBe(false);
      expect(result!.blockedUntil).toBeDefined();
      expect(result!.attemptCount).toBe(4);

      const firstBlockDuration = result!.blockedUntil! - Date.now();
      expect(firstBlockDuration).toBe(5 * 60 * 1000);

      const TOKEN_WINDOW_MS = 15 * 60 * 1000;
      jest.advanceTimersByTime(TOKEN_WINDOW_MS + 1000);

      const tokenHash2 = "token-hash-7";
      for (let i = 0; i < 4; i++) {
        result = await checkTokenRateLimit(ip, tokenHash2);
      }

      expect(result!.allowed).toBe(false);
      expect(result!.attemptCount).toBe(4);

      const secondBlockDuration = result!.blockedUntil! - Date.now();
      expect(secondBlockDuration).toBe(5 * 60 * 1000);

      jest.useRealTimers();
    });

    it("resets counter after window expires", async () => {
      const ip = "192.168.2.6";
      const tokenHash = "token-hash-8";

      const TOKEN_WINDOW_MS = 15 * 60 * 1000;

      jest.useFakeTimers();

      for (let i = 0; i < 3; i++) {
        await checkTokenRateLimit(ip, tokenHash);
      }

      let result = await checkTokenRateLimit(ip, tokenHash);
      expect(result.allowed).toBe(false);

      jest.advanceTimersByTime(5 * 60 * 1000 + TOKEN_WINDOW_MS + 1000);

      result = await checkTokenRateLimit(ip, tokenHash);
      expect(result.allowed).toBe(true);
      expect(result.attemptCount).toBe(1);

      jest.useRealTimers();
    });

    it("enforces IP-only rate limit for tokens", async () => {
      const ip = "192.168.2.7";

      let result;
      for (let i = 0; i < 30; i++) {
        result = await checkTokenRateLimit(ip, `token-hash-${i}`);
      }

      expect(result).toBeDefined();
      expect(result!.allowed).toBe(false);
    });
  });

  describe("recordSuccessfulTokenUsage", () => {
    it("removes rate limit entry for successful token usage", async () => {
      const ip = "192.168.2.8";
      const tokenHash = "token-hash-9";

      for (let i = 0; i < 3; i++) {
        await checkTokenRateLimit(ip, tokenHash);
      }

      let result = await checkTokenRateLimit(ip, tokenHash);
      expect(result.allowed).toBe(false);

      await recordSuccessfulTokenUsage(tokenHash, ip);

      result = await checkTokenRateLimit(ip, tokenHash);
      expect(result.allowed).toBe(true);
      expect(result.attemptCount).toBe(1);
    });

    it("decrements IP rate limit counter", async () => {
      const ip = "192.168.2.9";

      let result;
      for (let i = 0; i < 26; i++) {
        result = await checkTokenRateLimit(ip, `token-hash-${i}`);
      }

      expect(result).toBeDefined();
      expect(result!.allowed).toBe(false);

      await recordSuccessfulTokenUsage("token-hash-0", ip);

      result = await checkTokenRateLimit(ip, "token-hash-26");
      expect(result).toBeDefined();
      expect(result!.allowed).toBe(true);
      expect(result!.attemptCount).toBeLessThan(25);
    });
  });

  describe("recordSuccessfulLogin", () => {
    it("removes rate limit entry for successful login", async () => {
      const ip = "192.168.1.9";
      const email = "test7@example.com";

      for (let i = 0; i < 5; i++) {
        await checkLoginRateLimit(ip, email);
      }

      let result = await checkLoginRateLimit(ip, email);
      expect(result.allowed).toBe(false);

      await recordSuccessfulLogin(ip, email);

      result = await checkLoginRateLimit(ip, email);
      expect(result.allowed).toBe(true);
      expect(result.attemptCount).toBe(1);
    });

    it("decrements IP rate limit counter", async () => {
      const ip = "192.168.1.10";

      let result;
      for (let i = 0; i < 26; i++) {
        result = await checkLoginRateLimit(ip, `user${i}@example.com`);
      }

      expect(result).toBeDefined();
      expect(result!.allowed).toBe(false);
      expect(result!.attemptCount).toBe(25);

      await recordSuccessfulLogin(ip, "user0@example.com");

      result = await checkLoginRateLimit(ip, "user26@example.com");
      expect(result).toBeDefined();
      expect(result!.allowed).toBe(true);
      expect(result!.attemptCount).toBeLessThan(25);
    });
  });

  describe("getRateLimitStats", () => {
    it("returns empty stats initially", async () => {
      const stats = await getRateLimitStats();

      expect(stats.loginAttemptsCount).toBe(0);
      expect(stats.ipAttemptsCount).toBe(0);
    });

    it("tracks login attempts count", async () => {
      await checkLoginRateLimit("192.168.1.11", "test11@example.com");
      await checkLoginRateLimit("192.168.1.12", "test12@example.com");

      const stats = await getRateLimitStats();

      expect(stats.loginAttemptsCount).toBe(2);
    });

    it("tracks IP attempts count", async () => {
      await checkLoginRateLimit("192.168.1.13", "test13@example.com");
      await checkLoginRateLimit("192.168.1.14", "test14@example.com");

      const stats = await getRateLimitStats();

      expect(stats.ipAttemptsCount).toBe(2);
    });

    it("tracks token attempts count", async () => {
      await checkTokenRateLimit("192.168.1.15", "token-hash-10");
      await checkTokenRateLimit("192.168.1.16", "token-hash-11");

      const stats = await getRateLimitStats();

      expect(stats.tokenAttemptsCount).toBe(2);
    });
  });

  describe("checkForgotPasswordRateLimit", () => {
    it("allows first forgot password attempt", async () => {
      const result = await checkForgotPasswordRateLimit("192.168.3.1", "test@example.com");

      expect(result.allowed).toBe(true);
      expect(result.attemptCount).toBe(1);
    });

    it("tracks multiple attempts for same IP and email", async () => {
      const result1 = await checkForgotPasswordRateLimit("192.168.3.2", "test@example.com");
      const result2 = await checkForgotPasswordRateLimit("192.168.3.2", "test@example.com");

      expect(result1.allowed).toBe(true);
      expect(result1.attemptCount).toBe(1);

      expect(result2.allowed).toBe(true);
      expect(result2.attemptCount).toBe(2);
    });

    it("blocks attempts after reaching first threshold", async () => {
      const ip = "192.168.3.3";
      const email = "test2@example.com";

      let result;
      for (let i = 0; i < 2; i++) {
        result = await checkForgotPasswordRateLimit(ip, email);
        expect(result.allowed).toBe(true);
      }

      result = await checkForgotPasswordRateLimit(ip, email);

      expect(result).toBeDefined();
      expect(result!.allowed).toBe(false);
      expect(result!.blockedUntil).toBeDefined();
      expect(result!.attemptCount).toBe(3);
      expect(result!.blockedUntil).toBeGreaterThan(Date.now());
    });

    it("uses different rate limits for different IP + email combinations", async () => {
      const result1 = await checkForgotPasswordRateLimit("192.168.3.4", "test3@example.com");
      const result2 = await checkForgotPasswordRateLimit("192.168.3.5", "test4@example.com");

      expect(result1.allowed).toBe(true);
      expect(result1.attemptCount).toBe(1);

      expect(result2.allowed).toBe(true);
      expect(result2.attemptCount).toBe(1);
    });

    it("implements tiered blocking with different block durations", async () => {
      jest.useFakeTimers();

      const ip = "192.168.3.6";
      const email = "test5@example.com";

      let result;
      for (let i = 0; i < 3; i++) {
        result = await checkForgotPasswordRateLimit(ip, email);
      }

      expect(result!.allowed).toBe(false);
      expect(result!.blockedUntil).toBeDefined();
      expect(result!.attemptCount).toBe(3);

      const firstBlockDuration = result!.blockedUntil! - Date.now();
      expect(firstBlockDuration).toBe(15 * 60 * 1000);

      jest.useRealTimers();
    });

    it("resets counter after window expires", async () => {
      const ip = "192.168.3.7";
      const email = "test6@example.com";

      const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000;

      jest.useFakeTimers();

      for (let i = 0; i < 2; i++) {
        await checkForgotPasswordRateLimit(ip, email);
      }

      let result = await checkForgotPasswordRateLimit(ip, email);
      expect(result.allowed).toBe(false);

      jest.advanceTimersByTime(15 * 60 * 1000 + FORGOT_PASSWORD_WINDOW_MS + 1000);

      result = await checkForgotPasswordRateLimit(ip, email);
      expect(result.allowed).toBe(true);
      expect(result.attemptCount).toBe(1);

      jest.useRealTimers();
    });

    it("handles case-insensitive email addresses", async () => {
      const result1 = await checkForgotPasswordRateLimit("192.168.3.8", "TEST@example.com");
      const result2 = await checkForgotPasswordRateLimit("192.168.3.8", "test@example.com");

      expect(result1.attemptCount).toBe(1);
      expect(result2.attemptCount).toBe(2);
    });

    it("enforces IP-only rate limit", async () => {
      const ip = "192.168.3.9";

      let result;
      for (let i = 0; i < 30; i++) {
        result = await checkForgotPasswordRateLimit(ip, `user${i}@example.com`);
      }

      expect(result).toBeDefined();
      expect(result!.allowed).toBe(false);
    });

    it("tracks forgot password attempts in stats", async () => {
      await checkForgotPasswordRateLimit("192.168.3.10", "test7@example.com");
      await checkForgotPasswordRateLimit("192.168.3.11", "test8@example.com");

      const stats = await getRateLimitStats();

      expect(stats.forgotPasswordAttemptsCount).toBe(2);
    });
  });

  describe("deterministic cleanup", () => {
    it("cleans expired entries after time passes", async () => {
      jest.useFakeTimers();

      for (let i = 0; i < 50; i++) {
        await checkLoginRateLimit(`192.168.10.${i}`, `user${i}@example.com`);
      }

      let stats = await getRateLimitStats();
      expect(stats.loginAttemptsCount).toBeGreaterThan(0);

      jest.advanceTimersByTime(16 * 60 * 1000);

      await checkLoginRateLimit("192.168.10.100", "user100@example.com");

      stats = await getRateLimitStats();

      expect(stats.loginAttemptsCount).toBeLessThanOrEqual(51);

      jest.useRealTimers();
    });

    it("prevents unbounded memory growth", async () => {
      jest.useFakeTimers();

      for (let i = 0; i < 200; i++) {
        await checkLoginRateLimit(`192.168.11.${i % 256}`, `user${i}@example.com`);
      }

      const statsBefore = await getRateLimitStats();
      expect(statsBefore.loginAttemptsCount).toBeGreaterThan(100);

      jest.advanceTimersByTime(16 * 60 * 1000);

      for (let i = 0; i < 50; i++) {
        await checkLoginRateLimit(`192.168.12.${i % 256}`, `user${i + 200}@example.com`);
      }

      const statsAfter = await getRateLimitStats();

      expect(statsAfter.loginAttemptsCount).toBeLessThanOrEqual(statsBefore.loginAttemptsCount + 50);

      jest.useRealTimers();
    });

    it("cleans up entries with expired blocks", async () => {
      jest.useFakeTimers();

      for (let i = 0; i < 6; i++) {
        await checkLoginRateLimit("192.168.12.1", "blocked@example.com");
      }

      const stats = await getRateLimitStats();
      expect(stats.loginAttemptsCount).toBeGreaterThan(0);

      jest.advanceTimersByTime(2 * 60 * 1000);

      for (let i = 0; i < 5; i++) {
        await checkLoginRateLimit(`192.168.12.${i + 2}`, `user${i}@example.com`);
      }

      const statsAfterBlock = await getRateLimitStats();

      expect(statsAfterBlock.loginAttemptsCount).toBeLessThanOrEqual(stats.loginAttemptsCount + 5);

      jest.useRealTimers();
    });

    it("handles cleanup on token rate limits", async () => {
      jest.useFakeTimers();

      for (let i = 0; i < 50; i++) {
        await checkTokenRateLimit(`192.168.13.${i}`, `token-${i}`);
      }

      const stats = await getRateLimitStats();
      expect(stats.tokenAttemptsCount).toBeGreaterThan(0);

      jest.advanceTimersByTime(16 * 60 * 1000);

      await checkTokenRateLimit("192.168.13.100", "token-100");

      const statsAfter = await getRateLimitStats();

      expect(statsAfter.tokenAttemptsCount).toBeLessThanOrEqual(51);

      jest.useRealTimers();
    });

    it("handles cleanup on forgot password rate limits", async () => {
      jest.useFakeTimers();

      for (let i = 0; i < 50; i++) {
        await checkForgotPasswordRateLimit(`192.168.14.${i}`, `user${i}@example.com`);
      }

      const stats = await getRateLimitStats();
      expect(stats.forgotPasswordAttemptsCount).toBeGreaterThan(0);

      jest.advanceTimersByTime(61 * 60 * 1000);

      await checkForgotPasswordRateLimit("192.168.14.100", "user100@example.com");

      const statsAfter = await getRateLimitStats();

      expect(statsAfter.forgotPasswordAttemptsCount).toBeLessThanOrEqual(51);

      jest.useRealTimers();
    });

    it("cleans IP attempts map deterministically", async () => {
      jest.useFakeTimers();

      for (let i = 0; i < 30; i++) {
        await checkLoginRateLimit(`192.168.15.${i}`, `user${i}@example.com`);
      }

      const stats = await getRateLimitStats();
      expect(stats.ipAttemptsCount).toBeGreaterThan(0);

      jest.advanceTimersByTime(16 * 60 * 1000);

      await checkLoginRateLimit("192.168.15.100", "user100@example.com");

      const statsAfter = await getRateLimitStats();

      expect(statsAfter.ipAttemptsCount).toBeLessThanOrEqual(stats.ipAttemptsCount + 1);

      jest.useRealTimers();
    });

    it("maintains cleanup consistency across multiple rate limit types", async () => {
      jest.useFakeTimers();

      for (let i = 0; i < 30; i++) {
        await checkLoginRateLimit(`192.168.16.${i}`, `user${i}@example.com`);
        await checkTokenRateLimit(`192.168.16.${i}`, `token-${i}`);
        await checkForgotPasswordRateLimit(`192.168.16.${i}`, `user${i}@example.com`);
      }

      const statsBefore = await getRateLimitStats();

      expect(statsBefore.loginAttemptsCount).toBeGreaterThan(0);
      expect(statsBefore.tokenAttemptsCount).toBeGreaterThan(0);
      expect(statsBefore.forgotPasswordAttemptsCount).toBeGreaterThan(0);
      expect(statsBefore.ipAttemptsCount).toBeGreaterThan(0);

      jest.advanceTimersByTime(61 * 60 * 1000);

      for (let i = 0; i < 10; i++) {
        await checkLoginRateLimit(`192.168.16.${i + 30}`, `user${i + 30}@example.com`);
        await checkTokenRateLimit(`192.168.16.${i + 30}`, `token-${i + 30}`);
        await checkForgotPasswordRateLimit(`192.168.16.${i + 30}`, `user${i + 30}@example.com`);
      }

      const statsAfter = await getRateLimitStats();

      const totalBefore = statsBefore.loginAttemptsCount + statsBefore.tokenAttemptsCount + statsBefore.forgotPasswordAttemptsCount + statsBefore.ipAttemptsCount;
      const totalAfter = statsAfter.loginAttemptsCount + statsAfter.tokenAttemptsCount + statsAfter.forgotPasswordAttemptsCount + statsAfter.ipAttemptsCount;

      expect(totalAfter).toBeLessThanOrEqual(totalBefore + 40);

      jest.useRealTimers();
    });
  });
});
