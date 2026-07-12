interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private maxTokens: number;
  private refillRate: number; // Tokens refilled per second
  private refillInterval: number; // Interval in milliseconds

  constructor(maxTokens = 60, refillRate = 1) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.refillInterval = 1000;
  }

  private refill(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    
    if (elapsed > this.refillInterval) {
      const tokensToAdd = Math.floor(elapsed / 1000) * this.refillRate;
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now - (elapsed % 1000); // Preserve fractional seconds
    }
  }

  public isAllowed(key: string, limit = 1): boolean {
    let bucket = this.buckets.get(key);
    const now = Date.now();

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    this.refill(bucket);

    if (bucket.tokens >= limit) {
      bucket.tokens -= limit;
      return true;
    }

    return false;
  }

  // Cleanup old inactive buckets to prevent memory leaks
  public prune(maxAgeMs = 3600 * 1000): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAgeMs) {
        this.buckets.delete(key);
      }
    }
  }
}

// Export a default rate limiter: 60 requests per minute max, refill 1 token/sec
export const globalRateLimiter = new RateLimiter(60, 1);
// Auth-specific limiter: 10 requests max, refill 1 token per 6 seconds
// (onAuthStateChange can fire multiple events in rapid succession on login)
export const authRateLimiter = new RateLimiter(10, 1 / 6);

export default RateLimiter;
