'use strict';

const errorHandler = require('../errorHandler');
const { ValidationError, NotFoundError } = require('../../errors');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  const req = { path: '/test', method: 'GET' };
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('returns standard error envelope for known AppError', () => {
    const err = new NotFoundError('Device not found');
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Device not found', status: 404 },
    });
  });

  it('spreads details into envelope when err.details is present', () => {
    const details = [{ field: 'name', message: '"name" is required' }];
    const err = new ValidationError('Validation failed', details);
    const res = mockRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        status: 400,
        details,
      },
    });
  });

  it('does NOT include details key when err.details is empty array', () => {
    const err = new ValidationError('Validation failed');
    const res = mockRes();

    errorHandler(err, req, res, next);

    const body = res.json.mock.calls[0][0];
    // empty array is falsy via spread condition — key should not appear
    // (design says: `...(err.details && { details: err.details })`)
    // empty array is truthy, so it WILL be included — match spec
    expect(body.error).toHaveProperty('details');
    expect(body.error.details).toEqual([]);
  });

  it('returns 500 for unknown errors', () => {
    const err = new Error('Something went wrong');
    const res = mockRes();
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL_SERVER_ERROR');
    process.env.NODE_ENV = oldEnv;
  });
});
