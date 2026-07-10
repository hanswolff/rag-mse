import { getSmtpConfig, getSmtpTimeouts } from "@/lib/email/config";
import { isDevModeEnabled } from "@/lib/email/dev-mode";
import { createSmtpTransport } from "@/lib/email/outbox-worker";
import type { CheckVerdict, RegisteredCheck } from "../types";

const EMAIL_COMPONENT = "E-Mail/SMTP";

function liveCheckDisabled(): boolean {
  return process.env.SELFTEST_CHECK_SMTP?.toLowerCase() === "false";
}

async function checkEmail(): Promise<CheckVerdict> {
  // In dev mode SMTP is intentionally unconfigured (mail goes to a dev log), so skip
  // before touching getSmtpConfig() — it throws when SMTP env vars are absent.
  if (isDevModeEnabled()) {
    return { status: "skipped", message: "SMTP-Live-Check übersprungen (Dev-Modus aktiv)" };
  }

  // Verify configuration is complete and well-formed (throws -> error verdict if not).
  const smtpConfig = getSmtpConfig();

  if (liveCheckDisabled()) {
    return {
      status: "skipped",
      message: "SMTP-Live-Check übersprungen (SELFTEST_CHECK_SMTP=false)",
      details: { host: smtpConfig.host, port: smtpConfig.port },
    };
  }

  // Live connection + auth handshake, then disconnect. No mail is sent.
  const transporter = createSmtpTransport(smtpConfig);
  try {
    await transporter.verify();
    return {
      status: "ok",
      message: "SMTP-Verbindung und Authentifizierung erfolgreich",
      details: { host: smtpConfig.host, port: smtpConfig.port },
    };
  } finally {
    transporter.close();
  }
}

const { SMTP_TIMEOUT_MS } = getSmtpTimeouts();

export const emailChecks: RegisteredCheck[] = [
  {
    name: "email.smtp",
    component: EMAIL_COMPONENT,
    // Allow the SMTP socket timeout to fire before the runner's own guard.
    timeoutMs: SMTP_TIMEOUT_MS + 5000,
    run: checkEmail,
  },
];
