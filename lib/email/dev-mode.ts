import { constants as fsConstants, promises as fs } from "fs";
import path from "path";
import type { DevLogMethod, SmtpConfig, ClaimedOutgoingEmail } from "./types";
import { isValidDevLogMethod } from "./types";
import { logError, logInfo } from "../logger";

export function isDevModeEnabled(): boolean {
  return process.env.EMAIL_DEV_MODE === "true";
}

export function getDevLogMethod(): DevLogMethod {
  const method = process.env.EMAIL_DEV_LOG_METHOD || "logger";
  return isValidDevLogMethod(method) ? method : "logger";
}

export function getDevLogDir(): string {
  const configuredLogDir = process.env.EMAIL_DEV_LOG_DIR?.trim();
  const rawLogDir = configuredLogDir && configuredLogDir.length > 0
    ? configuredLogDir
    : path.resolve(process.cwd(), "data", "logs", "emails");
  return path.isAbsolute(rawLogDir) ? rawLogDir : path.resolve(process.cwd(), rawLogDir);
}

export async function ensureWritableLogDirectory(): Promise<string> {
  const configuredLogDir = getDevLogDir();
  const fallbackLogDir = path.resolve(process.cwd(), "data", "logs", "emails");
  const tmpLogDir = path.resolve("/tmp", "rag-mse", "emails");
  const candidates = [configuredLogDir, fallbackLogDir, tmpLogDir].filter(
    (candidate, index, all) => all.indexOf(candidate) === index
  );

  const errors: string[] = [];

  for (const logDir of candidates) {
    try {
      await fs.mkdir(logDir, { recursive: true });
      await fs.access(logDir, fsConstants.W_OK);

      if (logDir !== configuredLogDir) {
        logInfo("email_log_dir_fallback_used", "Configured email log directory is not writable, using fallback", {
          configuredLogDir,
          fallbackLogDir: logDir,
        });
      }

      return logDir;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`${logDir}: ${errorMessage}`);
      logError("email_log_dir_failed", "Failed to create or access email log directory", {
        logDir,
        error: errorMessage,
      });
    }
  }

  throw new Error(`No writable email log directory found (${errors.join("; ")})`);
}

export async function writeEmailToFile(
  email: ClaimedOutgoingEmail,
  smtpConfig: SmtpConfig
): Promise<string> {
  try {
    const logDir = await ensureWritableLogDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const filename = `${timestamp}_${email.id}_${randomSuffix}.eml`;
    const filePath = path.join(logDir, filename);

    const outerBoundary = `mixed-${email.id}-${randomSuffix}`;
    const alternativeBoundary = `alternative-${email.id}-${randomSuffix}`;

    const emailParts: string[] = [
      `From: ${smtpConfig.from}`,
      `To: ${email.toList.join(", ")}`,
      `Subject: ${email.subject}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
      "",
    ];

    const textPart = [
      `--${outerBoundary}`,
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      "",
      `--${alternativeBoundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      "",
      email.textBody,
    ].join("\r\n");

    const htmlPart = [
      "",
      `--${alternativeBoundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      "",
      email.htmlBody,
      "",
      `--${alternativeBoundary}--`,
    ].join("\r\n");

    emailParts.push(textPart + htmlPart);

    for (const attachment of email.attachments) {
      emailParts.push(
        [
          `--${outerBoundary}`,
          `Content-Type: ${attachment.contentType || "application/octet-stream"}`,
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          `Content-Transfer-Encoding: base64`,
          "",
          Buffer.from(attachment.content, "utf8").toString("base64"),
          "",
        ].join("\r\n")
      );
    }

    emailParts.push(`--${outerBoundary}--`, "");

    await fs.writeFile(filePath, emailParts.join("\r\n"), "utf8");

    return filePath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError("email_file_write_failed", "Failed to write email to file", {
      outboxId: email.id,
      template: email.template,
      error: errorMessage,
    });
    throw new Error(`Failed to write email to file: ${errorMessage}`);
  }
}

export async function logEmailToConsole(email: ClaimedOutgoingEmail, smtpConfig: SmtpConfig): Promise<void> {
  logInfo("email_dev_mode_logged", "[DEV MODE] Email logged instead of sent via SMTP", {
    outboxId: email.id,
    template: email.template,
    to: email.toList.join(", "),
    from: smtpConfig.from,
    subject: email.subject,
    textBody: email.textBody,
    htmlBody: email.htmlBody,
  });
}

export async function logEmailInDevMode(
  email: ClaimedOutgoingEmail,
  smtpConfig: SmtpConfig
): Promise<{ filePath?: string }> {
  const logMethod = getDevLogMethod();
  const result: { filePath?: string } = {};

  if (logMethod === "logger") {
    await logEmailToConsole(email, smtpConfig);
  } else if (logMethod === "file") {
    result.filePath = await writeEmailToFile(email, smtpConfig);
    logInfo("email_dev_mode_file_written", "[DEV MODE] Email written to file", {
      outboxId: email.id,
      template: email.template,
      to: email.toRecipients,
      filePath: result.filePath,
    });
  } else if (logMethod === "both") {
    await Promise.all([
      logEmailToConsole(email, smtpConfig),
      writeEmailToFile(email, smtpConfig).then(filePath => {
        result.filePath = filePath;
        logInfo("email_dev_mode_file_written", "[DEV MODE] Email written to file", {
          outboxId: email.id,
          template: email.template,
          to: email.toRecipients,
          filePath,
        });
      }),
    ]);
  }

  return result;
}
