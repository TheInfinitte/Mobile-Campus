/**
 * src/lib/env.ts
 * WHAT: Reads every environment variable in ONE place and checks that the
 *       important ones exist.
 * WHY : If a secret is missing we want a clear error message at startup
 *       ("FLW_SECRET_KEY is not set") instead of a confusing crash deep inside
 *       a payment route hours later.
 *
 * RULE: Anything that must stay secret lives here and is only imported by
 *       server-side code (API routes, server components). Never by a client
 *       component.
 */

/** Throws a helpful error if a required variable is missing or empty. */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing environment variable: ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value.trim();
}

/** Reads an optional variable and returns a default if it is not set. */
function optional(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

/** True when a value looks like a real secret rather than a placeholder. */
export function isConfigured(value: string | undefined): boolean {
  if (!value) return false;
  // Placeholder values from .env.example should count as "not configured".
  return !value.includes("replace-with") && !value.includes("your-") && value !== "true";
}

/**
 * Server-only configuration object.
 * Grouped by service so it is obvious where each key belongs.
 */
export const env = {
  app: {
    url: optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
    name: optional("NEXT_PUBLIC_APP_NAME", "Mobile Campus"),
    campus: optional("NEXT_PUBLIC_CAMPUS", "Delta State University, Abraka"),
    isProduction: process.env.NODE_ENV === "production",
  },

  security: {
    // Signs the login cookie so nobody can forge one.
    sessionSecret: optional("SESSION_SECRET", "dev-only-session-secret-change-me-32"),
    // Encrypts matric / JAMB / ID numbers before they touch the database.
    fieldEncryptionKey: optional("FIELD_ENCRYPTION_KEY", "dev-only-encryption-key-change-me-32"),
  },

  flutterwave: {
    publicKey: optional("FLW_PUBLIC_KEY"),
    secretKey: optional("FLW_SECRET_KEY"),
    encryptionKey: optional("FLW_ENCRYPTION_KEY"),
    // The hash set in the Flutterwave dashboard; used to verify webhooks.
    webhookHash: optional("FLW_WEBHOOK_HASH"),
    webhookPath: optional("FLW_WEBHOOK_URL", "/api/webhooks/flutterwave"),
    testMode: optional("FLW_TEST_MODE", "true") === "true",
    settlementBankCode: optional("FLW_SETTLEMENT_BANK_CODE"),
    settlementAccount: optional("FLW_SETTLEMENT_ACCOUNT"),
  },

  termii: {
    apiKey: optional("TERMII_API_KEY"),
    senderId: optional("TERMII_SENDER_ID", "MobileCampus"),
  },

  cloudinary: {
    cloudName: optional("CLOUDINARY_CLOUD_NAME"),
    uploadPreset: optional("CLOUDINARY_UPLOAD_PRESET"),
  },

  anthropic: {
    apiKey: optional("ANTHROPIC_API_KEY"),
    model: optional("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
  },
} as const;

/**
 * assertServerSecrets
 * WHAT: Called once at the start of money/AI routes to confirm the secrets
 *       they need are present.
 * WHY : Payments and AI must fail loudly and safely instead of charging
 *       someone with a broken configuration.
 */
export function assertFlutterwaveConfigured(): void {
  required("FLW_SECRET_KEY");
  required("FLW_ENCRYPTION_KEY");
}

export function assertAnthropicConfigured(): void {
  required("ANTHROPIC_API_KEY");
}
