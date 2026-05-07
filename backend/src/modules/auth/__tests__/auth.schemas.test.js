'use strict';

const schemas = require('../auth.schemas');

describe('auth.schemas', () => {
  describe('register', () => {
    it('accepts a valid payload', () => {
      const { error } = schemas.register.validate({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@test.com',
        password: 'secret',
      });
      expect(error).toBeUndefined();
    });

    it('rejects missing tenantId', () => {
      const { error } = schemas.register.validate({ email: 'u@t.com', password: 's' });
      expect(error).toBeDefined();
      const fields = error.details.map((d) => d.path[0]);
      expect(fields).toContain('tenantId');
    });

    it('rejects invalid tenantId (not uuid)', () => {
      const { error } = schemas.register.validate({
        tenantId: 'not-a-uuid',
        email: 'u@t.com',
        password: 's',
      });
      expect(error).toBeDefined();
    });

    it('accepts optional role as admin or installer', () => {
      const { error: e1 } = schemas.register.validate({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'u@t.com',
        password: 's',
        role: 'admin',
      });
      expect(e1).toBeUndefined();

      const { error: e2 } = schemas.register.validate({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'u@t.com',
        password: 's',
        role: 'superadmin',
      });
      expect(e2).toBeDefined();
    });
  });

  describe('refresh', () => {
    it('accepts an empty body (token read from httpOnly cookie)', () => {
      const { error } = schemas.refresh.validate({});
      expect(error).toBeUndefined();
    });

    it('strips unknown fields', () => {
      const { value, error } = schemas.refresh.validate(
        { rogue: 'field' },
        { stripUnknown: true }
      );
      expect(error).toBeUndefined();
      expect(value.rogue).toBeUndefined();
    });
  });
});
