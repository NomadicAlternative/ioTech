'use strict';

const paginate = require('../paginate');
const { ValidationError } = require('../../errors');

describe('paginate() middleware', () => {
  function mockReq(query = {}) {
    return { query };
  }

  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  // ── Task 6, scenario 1: defaults ─────────────────────────────────────────
  it('attaches default pagination when no query params are provided', () => {
    const middleware = paginate();
    const req = mockReq({});
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.pagination).toEqual({
      page: 1,
      limit: 20,
      sortBy: null,
      sortDir: 'asc',
    });
  });

  // ── Triangulate: explicit valid params ────────────────────────────────────
  it('parses valid page and limit from query', () => {
    const middleware = paginate();
    const req = mockReq({ page: '2', limit: '10' });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.pagination.page).toBe(2);
    expect(req.pagination.limit).toBe(10);
    expect(req.pagination.sortBy).toBeNull();
    expect(req.pagination.sortDir).toBe('asc');
  });

  // ── Triangulate: limit clamped silently ───────────────────────────────────
  it('clamps limit to 100 when limit > 100 (no error)', () => {
    const middleware = paginate();
    const req = mockReq({ limit: '999' });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.pagination.limit).toBe(100);
  });

  // ── Triangulate: invalid page → ValidationError ───────────────────────────
  it('calls next(ValidationError) when page is non-numeric', () => {
    const middleware = paginate();
    const req = mockReq({ page: 'abc' });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.details[0].field).toBe('page');
  });

  // ── Triangulate: invalid limit → ValidationError ──────────────────────────
  it('calls next(ValidationError) when limit is non-numeric', () => {
    const middleware = paginate();
    const req = mockReq({ limit: 'xyz' });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.details[0].field).toBe('limit');
  });

  // ── Triangulate: sortBy and sortDir ──────────────────────────────────────
  it('parses sortBy and sortDir params', () => {
    const middleware = paginate();
    const req = mockReq({ sortBy: 'name', sortDir: 'desc' });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.pagination.sortBy).toBe('name');
    expect(req.pagination.sortDir).toBe('desc');
  });

  // ── Triangulate: sortDir defaults to asc even with sortBy ─────────────────
  it('defaults sortDir to "asc" when not provided', () => {
    const middleware = paginate();
    const req = mockReq({ sortBy: 'created_at' });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.pagination.sortDir).toBe('asc');
  });
});
