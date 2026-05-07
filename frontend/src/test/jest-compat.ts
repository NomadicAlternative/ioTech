/**
 * Jest compatibility shim for Vitest.
 *
 * The pre-existing RuleForm tests use global `jest` (jest.fn, jest.mock, etc.)
 * which Vitest does not provide. This shim maps `jest` to the `vi` object
 * for backward compatibility with existing tests that use jest globals.
 */
import { vi } from 'vitest';

const jestCompat = {
  fn: vi.fn,
  spyOn: vi.spyOn,
  mock: vi.mock as unknown,
  unmock: vi.unmock as unknown,
  clearAllMocks: vi.clearAllMocks,
  resetAllMocks: vi.resetAllMocks,
  restoreAllMocks: vi.restoreAllMocks,
  useFakeTimers: vi.useFakeTimers as unknown,
  useRealTimers: vi.useRealTimers as unknown,
  advanceTimersByTime: vi.advanceTimersByTime as unknown,
  advanceTimersToNextTimer: vi.advanceTimersToNextTimer as unknown,
};

// Expose as global `jest` for backward compatibility
(globalThis as Record<string, unknown>).jest = jestCompat;
