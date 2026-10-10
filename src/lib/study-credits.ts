/**
 * src/lib/study-credits.ts
 * WHAT: The numbers behind the Study Vault give-to-get economy.
 * WHY : Both the download route (spending) and the admin approval route
 *       (earning) must agree on these, so they live in one place.
 */

/** Free downloads granted to each newly verified student (welcome credit). */
export const CREDITS_PER_APPROVED_UPLOAD = 2;

/** A safety cap so credits cannot pile up forever. */
export const CREDIT_CAP = 20;
