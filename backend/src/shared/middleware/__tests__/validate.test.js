'use strict';

const Joi = require('joi');
const validate = require('../validate');
const { ValidationError } = require('../../errors');

describe('validate() middleware factory', () => {
  function mockReq(target, data) {
    return { body: {}, query: {}, params: {}, [target]: data };
  }

  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  // ── Task 3, scenario 1: valid payload calls next() ──────────────────────────
  it('calls next() without error when body is valid', () => {
    const schema = Joi.object({ name: Joi.string().required() });
    const middleware = validate(schema);
    const req = mockReq('body', { name: 'Sensor A' });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();  // no args → success
    expect(next).toHaveBeenCalledTimes(1);
  });

  // ── Triangulate: missing required field → ValidationError ───────────────────
  it('calls next(ValidationError) when required field is missing', () => {
    const schema = Joi.object({ name: Joi.string().required() });
    const middleware = validate(schema);
    const req = mockReq('body', {});
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.details).toHaveLength(1);
    expect(err.details[0].field).toBe('name');
    expect(typeof err.details[0].message).toBe('string');
  });

  // ── Triangulate: multiple fields fail, all reported (abortEarly: false) ─────
  it('reports all validation errors (abortEarly: false)', () => {
    const schema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
    });
    const middleware = validate(schema);
    const req = mockReq('body', {});
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.details.length).toBeGreaterThanOrEqual(2);
  });

  // ── Triangulate: target = 'query' ────────────────────────────────────────────
  it('validates req.query when target is "query"', () => {
    const schema = Joi.object({ limit: Joi.number().integer().required() });
    const middleware = validate(schema, 'query');
    const req = mockReq('query', {});
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.details[0].field).toBe('limit');
  });

  // ── Triangulate: unknown fields are stripped (stripUnknown: true) ────────────
  it('strips unknown fields from the request target', () => {
    const schema = Joi.object({ name: Joi.string().required() });
    const middleware = validate(schema);
    const req = mockReq('body', { name: 'Sensor A', unknownField: 'bye' });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();  // passes
    expect(req.body.unknownField).toBeUndefined();
    expect(req.body.name).toBe('Sensor A');
  });
});
