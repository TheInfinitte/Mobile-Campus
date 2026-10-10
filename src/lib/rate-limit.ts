/**
 * src/lib/rate-limit.ts
 * WHAT: A tiny in-memory rate limiter that counts requests per key.
 * WHY : Nigerian OTP SMS costs money, and unthrottled endpoints get abused by
 *       bots. We limit how often a phone number or IP address can ask for a
 *       code, send a message, or call the AI assistant.
 *
 * NOTE: This stores counts in the server's memory. That is fine for one server
 * and for development. If you scale to many servers, swap the Map for Redis
 * using the same function names - nothing else in the app has to change.
 */

/** One bucket of counts for one key (for example one phone number). */
type Bucket = {
  count: number;      // How many requests in the current window.
  resetAt: number;    // Timestamp (ms) when the count resets to zero.
};

// The store: key -> bucket.
const store = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;  // Can this request go ahead?
  remaining: number; // How many requests are left in this window.
  retryAfterMs: number; // How long to wait before trying again.
};

/**
 * rateLimit
 * WHAT: Allows `limit` requests per `windowMs` for a given key.
 * WHY : One simple function protects every sensitive endpoint.
 *
 * Example: rateLimit(`otp:${phone}`, 3, 5 * 60 * 1000)
 *          = 3 OTP requests per phone number every 5 minutes.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key);

  // No bucket yet, or the window has expired: start a fresh count.
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  // Same window: increase the count.
  bucket.count += 1;

  if (bucket.count > limit) {
    // Too many requests - tell the caller how long to wait.
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

/**
 * peekRateLimit
 * WHAT: Reports how long is left on a key's current window WITHOUT counting a
 *       request. Returns 0 when the key has no active window.
 * WHY : The sign-up screen wants to show "you can ask for another code in 42
 *       seconds". Calling rateLimit() to find that out would itself consume one
 *       of the user's requests, so they would be penalised for merely looking.
 */
export function peekRateLimit(key: string): number {
  const bucket = store.get(key);
  if (!bucket) return 0;

  const remainingMs = bucket.resetAt - Date.now();
  // An expired window behaves as no window at all.
  return remainingMs > 0 ? remainingMs : 0;
}

/**
 * rateLimitRemaining
 * WHAT: How many requests are left in a key's current window, without counting
 *       one. A key with no active window has its full allowance available, so we
 *       cannot answer that here - callers pass the limit they care about.
 * WHY : timeUntilNextOtp needs to know whether the hourly code allowance is used
 *       up, which is a different question from "how long until the window ends".
 */
export function rateLimitRemaining(key: string, limit: number): number {
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= Date.now()) return limit;
  return Math.max(0, limit - bucket.count);
}

/**
 * resetRateLimit
 * WHAT: Clears the counter for a key.
 * WHY : After a successful OTP verification we clear the attempts so a genuine
 *       user is not punished for one typo.
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * cleanupRateLimitStore
 * WHAT: Deletes expired buckets.
 * WHY : Without this the Map would grow forever on a long-running server.
 *       Next.js calls this lazily on each check, which is cheap enough.
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

// Clean up expired entries every 10 minutes while the server is running.
// `globalThis` guard stops multiple timers when Next.js hot-reloads.
const globalForTimer = globalThis as unknown as { __mcRateLimitTimer?: NodeJS.Timeout };
if (!globalForTimer.__mcRateLimitTimer) {
  globalForTimer.__mcRateLimitTimer = setInterval(cleanupRateLimitStore, 10 * 60 * 1000);
  // Do not keep the Node process alive just for this timer.
  if (typeof globalForTimer.__mcRateLimitTimer.unref === "function") {
    globalForTimer.__mcRateLimitTimer.unref();
  }
}
