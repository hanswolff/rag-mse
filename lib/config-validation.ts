interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSECURE_PASSWORDS = new Set(["AdminPass123", "admin123", "password"]);

export function validateProductionConfig(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  const isProduction = process.env.NODE_ENV === "production" && process.env.DEVELOPMENT_DEPLOYMENT !== "true";

  const requireEnv = (name: string, description: string): void => {
    if (!process.env[name]?.trim()) {
      result.isValid = false;
      result.errors.push(`${name} (${description}) muss in Produktion gesetzt sein`);
    }
  };

  const requireValidUrl = (name: string, description: string, mustBeHttps = false): void => {
    const value = process.env[name];
    if (!value?.trim()) {
      result.isValid = false;
      result.errors.push(`${name} (${description}) muss gesetzt sein`);
      return;
    }

    try {
      const url = new URL(value);
      if (mustBeHttps && url.protocol !== "https:") {
        result.isValid = false;
        result.errors.push(`${name} muss in Produktion HTTPS verwenden (aktuell: ${value})`);
      }
    } catch {
      result.isValid = false;
      result.errors.push(`${name} (${description}) ist keine gültige URL: ${value}`);
    }
  };

  const rejectLocalhost = (name: string, url?: string): void => {
    if (url && (url.includes("localhost") || url.includes("127.0.0.1"))) {
      result.isValid = false;
      result.errors.push(`${name} sollte in Produktion keine Localhost-URL verwenden`);
    }
  };

  const validateBooleanEnvVar = (name: string): void => {
    const value = process.env[name]?.toLowerCase();
    const validValues = ["true", "false"];
    if (value && !validValues.includes(value)) {
      result.warnings.push(
        `${name} hat einen ungültigen Wert: ${process.env[name]} (erwartet: true oder false)`
      );
    }
  };

  const validateNextAuthSecret = (): void => {
    if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
      result.errors.push(
        "NEXTAUTH_SECRET muss gesetzt sein und mindestens 32 Zeichen lang sein (in allen Umgebungen)"
      );
      result.isValid = false;
    }
  };

  validateNextAuthSecret();

  if (isProduction) {
    requireValidUrl("NEXTAUTH_URL", "NextAuth URL", true);
    requireValidUrl("APP_URL", "Anwendungs-URL", true);

    if (process.env.COOKIE_SECURE !== "true") {
      result.errors.push("COOKIE_SECURE muss in Produktion auf 'true' gesetzt sein");
      result.isValid = false;
    }

    requireEnv("SMTP_HOST", "SMTP-Host");
    requireEnv("SMTP_PORT", "SMTP-Port");
    requireEnv("SMTP_USER", "SMTP-Benutzer");
    requireEnv("SMTP_PASSWORD", "SMTP-Passwort");
    requireEnv("SMTP_FROM", "Absender-E-Mail");
    requireEnv("ADMIN_EMAILS", "Admin-Empfänger-Liste");

    const seedAdminEmail = process.env.SEED_ADMIN_EMAIL;
    const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
    const seedAdminName = process.env.SEED_ADMIN_NAME;

    if (seedAdminEmail || seedAdminPassword || seedAdminName) {
      if (!seedAdminEmail || !seedAdminPassword || !seedAdminName) {
        result.errors.push(
          "SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD und SEED_ADMIN_NAME müssen alle gesetzt oder alle ungesetzt sein"
        );
        result.isValid = false;
      }

      if (seedAdminEmail && !EMAIL_REGEX.test(seedAdminEmail)) {
        result.errors.push(
          `SEED_ADMIN_EMAIL hat kein gültiges E-Mail-Format: ${seedAdminEmail}`
        );
        result.isValid = false;
      }

      if (seedAdminPassword && INSECURE_PASSWORDS.has(seedAdminPassword)) {
        result.warnings.push(
          "SEED_ADMIN_PASSWORD verwendet ein unsicheres Standardpasswort. Bitte ändern Sie dies in Produktion!"
        );
      }
    }

    rejectLocalhost("NEXTAUTH_URL", process.env.NEXTAUTH_URL);
    rejectLocalhost("APP_URL", process.env.APP_URL);

    validateBooleanEnvVar("ALLOW_DB_PUSH");
    validateBooleanEnvVar("ALLOW_DB_SEED");
  } else {
    if (!process.env.NEXTAUTH_URL) {
      result.warnings.push("NEXTAUTH_URL ist nicht gesetzt, verwendet Default");
    }
    if (!process.env.SMTP_HOST) {
      result.warnings.push(
        "SMTP-Konfiguration ist nicht vollständig gesetzt, E-Mail-Funktionalität könnte nicht funktionieren"
      );
    }
  }

  return result;
}

export function printValidationResults(result: ValidationResult): void {
  if (result.errors.length > 0) {
    console.error("\n❌ Konfigurations-Validierung fehlgeschlagen:");
    result.errors.forEach((error) => console.error(`   - ${error}`));
    console.error("\nBitte korrigieren Sie diese Fehler bevor Sie die Anwendung in Produktion starten.");
  }

  if (result.warnings.length > 0) {
    console.warn("\n⚠️  Konfigurations-Warnungen:");
    result.warnings.forEach((warning) => console.warn(`   - ${warning}`));
  }

  if (result.isValid && result.warnings.length === 0) {
    console.log("✓ Konfigurations-Validierung erfolgreich");
  }
}
