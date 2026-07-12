import { describe, it, expect, vi } from 'vitest';
import { eventSystem } from '@/services/EventSystem';
import RateLimiter from '@/lib/rateLimit';

describe('EventSystem Tests', () => {
  it('should register callback and execute on publish', async () => {
    const callback = vi.fn();
    const event = 'test-event';
    const payload = { score: 100 };

    const unsubscribe = eventSystem.subscribe(event, callback);
    await eventSystem.publish(event, payload);

    expect(callback).toHaveBeenCalledWith(payload);
    
    unsubscribe();
    await eventSystem.publish(event, payload);
    expect(callback).toHaveBeenCalledTimes(1); // Unsubscribed, should not trigger again
  });
});

describe('RateLimiter Tests', () => {
  it('should limit request frequency based on limits', () => {
    // Limiter with max 2 tokens, refills 0 tokens per second (frozen)
    const limiter = new RateLimiter(2, 0);

    expect(limiter.isAllowed('user-1')).toBe(true);
    expect(limiter.isAllowed('user-1')).toBe(true);
    expect(limiter.isAllowed('user-1')).toBe(false); // Max 2 tokens exceeded
  });
});
