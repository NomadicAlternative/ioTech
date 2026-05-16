'use strict';

/**
 * Unit tests for admin.schemas.js — Joi validation schemas.
 */

describe('admin schemas', () => {
  let schemas;

  beforeEach(() => {
    jest.resetModules();
    schemas = require('../admin.schemas');
  });

  describe('dashboardQuery', () => {
    it('accepts empty query (no params required)', () => {
      const { error, value } = schemas.dashboardQuery.validate({});
      expect(error).toBeUndefined();
      expect(value).toEqual({});
    });

    it('rejects unknown query parameters', () => {
      const { error } = schemas.dashboardQuery.validate({
        unknown: 'field',
      });
      expect(error).toBeDefined();
      expect(error.details[0].message).toMatch(/not allowed/i);
    });
  });

  describe('tenantIdParams', () => {
    it('accepts a valid UUID tenant ID', () => {
      const { error, value } = schemas.tenantIdParams.validate({
        id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(error).toBeUndefined();
      expect(value).toHaveProperty('id');
    });

    it('rejects a non-UUID tenant ID', () => {
      const { error } = schemas.tenantIdParams.validate({ id: 'not-a-uuid' });
      expect(error).toBeDefined();
      expect(error.details[0].message).toMatch(/GUID|uuid/i);
    });

    it('rejects an empty id param', () => {
      const { error } = schemas.tenantIdParams.validate({ id: '' });
      expect(error).toBeDefined();
    });
  });
});
