/**
 * src/lib/encrypt.ts
 * WHAT: Encrypts and decrypts sensitive identity numbers (matric number, JAMB
 *       registration number, national ID) using AES-256-GCM.
 * WHY : The Nigeria Data Protection Act (NDPA) requires us to protect personal
 *       data. If the database ever leaks, encrypted values are useless without
 *       the key, which only lives in the server environment.
 *
 * HOW IT WORKS (simple version):
 *   plain text  --(key + random IV)-->  "iv:tag:ciphertext"  (safe to store)
 *   stored text --(key)-------------->  plain text again
 */
import crypto from "crypto";
import { env } from "./env";

const ALGORITHM = "aes-256-gcm"; // A strong, standard encryption mode.
const IV_LENGTH = 12;            // GCM recommends a 12-byte nonce.
const KEY_LENGTH = 32;           // 256 bits = 32 bytes.

/**
 * deriveKey
 * WHAT: Turns our text secret into exactly 32 bytes.
 * WHY : AES-256 needs a key of that exact size, but our env var is a normal
 *       string of any length. Hashing with SHA-256 always gives 32 bytes.
 */
function deriveKey(): Buffer {
  return crypto.createHash("sha256").update(env.security.fieldEncryptionKey).digest();
}

/**
 * encrypt
 * WHAT: Encrypts a plain string and returns "iv:tag:ciphertext" in base64.
 * WHY : We store the IV and the authentication tag alongside the ciphertext so
 *       we can decrypt it later AND detect if anyone tampered with the value.
 */
export function encrypt(plainText: string): string {
  if (!plainText) return "";

  const iv = crypto.randomBytes(IV_LENGTH); // A fresh random nonce every time.
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(), iv);

  // Encrypt the text.
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  // The tag proves the data has not been altered.
  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

/**
 * decrypt
 * WHAT: Reverses `encrypt`. Returns an empty string if the value is missing or
 *       cannot be decrypted, so a bad row never crashes a page.
 * WHY : Admins occasionally need to see the real number to verify it against
 *       the school's list. Nobody else ever calls this.
 */
export function decrypt(stored: string | null | undefined): string {
  if (!stored) return "";

  try {
    const parts = stored.split(":");
    // Older or invalid rows will not have three parts.
    if (parts.length !== 3) return "";

    const [ivPart, tagPart, dataPart] = parts;
    const iv = Buffer.from(ivPart, "base64");
    const tag = Buffer.from(tagPart, "base64");
    const data = Buffer.from(dataPart, "base64");

    const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(), iv);
    decipher.setAuthTag(tag); // Throws if the data was tampered with.

    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    // Decryption failed - treat it as unreadable rather than crashing.
    return "";
  }
}

/**
 * hashForSearch
 * WHAT: A one-way fingerprint of a sensitive number.
 * WHY : We can check "does this matric number already exist?" by comparing
 *       hashes, without ever decrypting the stored values. Hashing is one-way,
 *       so it is safe to keep in the database.
 */
export function hashForSearch(value: string): string {
  return crypto.createHmac("sha256", env.security.fieldEncryptionKey).update(value.trim().toUpperCase()).digest("hex");
}

/**
 * maskIdentifier
 * WHAT: Hides all but the last 4 characters, e.g. "DEU/STS/21/0142" -> "****0142".
 * WHY : We must never show a full matric or JAMB number in the UI, but the user
 *       still needs to recognise which number they submitted.
 */
export function maskIdentifier(value: string | null | undefined): string {
  if (!value) return "";
  const clean = value.trim();
  if (clean.length <= 4) return "****";
  return `****${clean.slice(-4)}`;
}

/**
 * lastFour
 * WHAT: Returns just the final 4 characters of a number.
 * WHY : Stored in plain text (identifierLast4) so admins can search the
 *       verification queue quickly without decrypting every row.
 */
export function lastFour(value: string): string {
  const clean = value.trim();
  return clean.length <= 4 ? clean : clean.slice(-4);
}
