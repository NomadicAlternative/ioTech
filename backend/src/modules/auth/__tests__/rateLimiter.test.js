'use strict';

/**
 * Unit tests for rateLimiter module.
 *
 * Covers:
 *  - TooManyRequestsError class (shared/errors.js)
 *  - Key generators (loginKeyGenerator, ipKeyGenerator) — pure functions
 *  - Skip condition logic (process.env.AUTH_RATE_LIMIT_ENABLED === 'false')
 *
 * RED phase for key-gen/skip: rateLimiter.js does not exist yet.
 */

const { TooManyRequestsError, AppError } = require('../../../shared/errors');

// ─── Task 4: rateLimiter.js (does not exist yet — RED) ───────────────────────
// These imports will fail until Task 5 creates the module.
const { loginKeyGenerator, ipKeyGenerator } = require('../rateLimiter');

describe('TooManyRequestsError', () => {
  it('extends AppError', () => {
    const err = new TooManyRequestsError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has statusCode 429', () => {
    const err = new TooManyRequestsError();
    expect(err.statusCode).toBe(429);
  });

  it('has code RATE_LIMIT_EXCEEDED', () => {
    const err = new TooManyRequestsError();
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('has isOperational = true', () => {
    const err = new TooManyRequestsError();
    expect(err.isOperational).toBe(true);
  });

  it('uses provided message', () => {
    const err = new TooManyRequestsError('Custom message');
    expect(err.message).toBe('Custom message');
  });

  it('has default message "Too many requests" when no argument', () => {
    const err = new TooManyRequestsError();
    expect(err.message).toBe('Too many requests');
  });
});

// ─── Key generators (pure functions) ────────────────────────────────────────

describe('loginKeyGenerator', () => {
  it('produces compound key "ip:tenantId"', () => {
    const req = { ip: '1.2.3.4', body: { tenantId: 't1' } };
    expect(loginKeyGenerator(req)).toBe('1.2.3.4:t1');
  });

  it('falls back to "unknown" when tenantId is missing from body', () => {
    const req = { ip: '1.2.3.4', body: {} };
    expect(loginKeyGenerator(req)).toBe('1.2.3.4:unknown');
  });

  it('falls back to "unknown" when tenantId is null', () => {
    const req = { ip: '1.2.3.4', body: { tenantId: null } };
    expect(loginKeyGenerator(req)).toBe('1.2.3.4:unknown');
  });

  it('falls back to "unknown" when tenantId is empty string', () => {
    const req = { ip: '1.2.3.4', body: { tenantId: '' } };
    expect(loginKeyGenerator(req)).toBe('1.2.3.4:unknown');
  });

  it('differentiates by IP', () => {
    const req = { ip: '5.6.7.8', body: { tenantId: 't1' } };
    expect(loginKeyGenerator(req)).toBe('5.6.7.8:t1');
  });

  it('differentiates by tenantId', () => {
    const req = { ip: '1.2.3.4', body: { tenantId: 't2' } };
    expect(loginKeyGenerator(req)).toBe('1.2.3.4:t2');
  });

  it('falls back to "unknown" when body is absent entirely', () => {
    const req = { ip: '1.2.3.4' };
    expect(loginKeyGenerator(req)).toBe('1.2.3.4:unknown');
  });
});

describe('ipKeyGenerator', () => {
  it('returns the IP for IPv4', () => {
    const req = { ip: '1.2.3.4' };
    expect(ipKeyGenerator(req)).toBe('1.2.3.4');
  });

  it('returns the IP for IPv6', () => {
    const req = { ip: '::1' };
    expect(ipKeyGenerator(req)).toBe('::1');
  });
});

// ─── Skip condition (inline logic) ──────────────────────────────────────────

describe('skip condition (AUTH_RATE_LIMIT_ENABLED)', () => {
  const shouldSkip = () => process.env.AUTH_RATE_LIMIT_ENABLED === 'false';

  beforeEach(() => {
    delete process.env.AUTH_RATE_LIMIT_ENABLED;
  });

  it("returns false (don't skip) when env var is not set", () => {
    delete process.env.AUTH_RATE_LIMIT_ENABLED;
    expect(shouldSkip()).toBe(false);
  });

  it('returns false (don\'t skip) when env var is "true"', () => {
    process.env.AUTH_RATE_LIMIT_ENABLED = 'true';
    expect(shouldSkip()).toBe(false);
  });

  it('returns true (skip) when env var is "false"', () => {
    process.env.AUTH_RATE_LIMIT_ENABLED = 'false';
    expect(shouldSkip()).toBe(true);
  });

  it("returns false (don't skip) for any other garbage value", () => {
    process.env.AUTH_RATE_LIMIT_ENABLED = 'nonsense';
    expect(shouldSkip()).toBe(false);
  });
});
