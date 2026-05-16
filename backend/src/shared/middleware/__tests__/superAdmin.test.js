'use strict';

/**
 * Unit tests for superAdmin middleware.
 *
 * Tests the dual-check behavior: access is granted if EITHER
 * req.user.email is in SUPER_ADMIN_EMAILS OR req.user.role === 'super_admin'.
 */

const { ForbiddenError } = require('../../errors');

describe('superAdmin middleware', () => {
  let superAdmin;
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();

    req = { user: {} };
    res = {};
    next = jest.fn();

    delete process.env.SUPER_ADMIN_EMAILS;
  });

  it('grants access when user role is super_admin (no email env var set)', () => {
    process.env.SUPER_ADMIN_EMAILS = '';
    req.user = { email: 'admin@example.com', role: 'super_admin' };

    superAdmin = require('../superAdmin');
    superAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('grants access when user email is in SUPER_ADMIN_EMAILS (no role)', () => {
    process.env.SUPER_ADMIN_EMAILS = 'admin@iotech.dev, root@example.com';
    req.user = { email: 'admin@iotech.dev', role: 'installer' };

    superAdmin = require('../superAdmin');
    superAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns ForbiddenError when neither role nor email matches', () => {
    process.env.SUPER_ADMIN_EMAILS = 'admin@iotech.dev';
    req.user = { email: 'some@user.com', role: 'installer' };

    superAdmin = require('../superAdmin');
    superAdmin(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ForbiddenError');
    expect(err.statusCode).toBe(403);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('grants access when BOTH email and role match (dual path)', () => {
    process.env.SUPER_ADMIN_EMAILS = 'admin@iotech.dev';
    req.user = { email: 'admin@iotech.dev', role: 'super_admin' };

    superAdmin = require('../superAdmin');
    superAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns ForbiddenError when user object is missing entirely', () => {
    process.env.SUPER_ADMIN_EMAILS = 'admin@iotech.dev';
    req.user = undefined;

    superAdmin = require('../superAdmin');
    superAdmin(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ForbiddenError');
    expect(err.statusCode).toBe(403);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns ForbiddenError when req.user.role is falsy and email not in list', () => {
    process.env.SUPER_ADMIN_EMAILS = 'admin@iotech.dev';
    req.user = { email: 'other@example.com', role: null };

    superAdmin = require('../superAdmin');
    superAdmin(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ForbiddenError');
    expect(err.statusCode).toBe(403);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('handles case-insensitive email comparison', () => {
    process.env.SUPER_ADMIN_EMAILS = 'Admin@Iotech.Dev';
    req.user = { email: 'admin@iotech.dev', role: 'installer' };

    superAdmin = require('../superAdmin');
    superAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('handles whitespace in SUPER_ADMIN_EMAILS env var', () => {
    process.env.SUPER_ADMIN_EMAILS = ' admin@iotech.dev , root@example.com ';
    req.user = { email: 'admin@iotech.dev', role: 'installer' };

    superAdmin = require('../superAdmin');
    superAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('role === super_admin overrides expired/no email list', () => {
    process.env.SUPER_ADMIN_EMAILS = '';
    req.user = { email: '', role: 'super_admin' };

    superAdmin = require('../superAdmin');
    superAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
