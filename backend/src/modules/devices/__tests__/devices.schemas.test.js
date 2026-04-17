'use strict';

const schemas = require('../devices.schemas');

describe('devices.schemas', () => {
  describe('create', () => {
    it('accepts valid payload with name only', () => {
      const { error } = schemas.create.validate({ name: 'Sensor A' });
      expect(error).toBeUndefined();
    });

    it('rejects empty name', () => {
      const { error } = schemas.create.validate({ name: '' });
      expect(error).toBeDefined();
    });

    it('rejects missing name', () => {
      const { error } = schemas.create.validate({});
      expect(error).toBeDefined();
      expect(error.details[0].path[0]).toBe('name');
    });

    it('strips unknown fields', () => {
      const { value } = schemas.create.validate(
        { name: 'Sensor A', rogue: 'field' },
        { stripUnknown: true }
      );
      expect(value.rogue).toBeUndefined();
    });
  });

  describe('update', () => {
    it('accepts empty object (all optional)', () => {
      const { error } = schemas.update.validate({});
      expect(error).toBeUndefined();
    });

    it('rejects name exceeding 120 chars', () => {
      const { error } = schemas.update.validate({ name: 'a'.repeat(121) });
      expect(error).toBeDefined();
    });
  });

  describe('authenticate', () => {
    it('requires device_token', () => {
      const { error } = schemas.authenticate.validate({});
      expect(error).toBeDefined();
      expect(error.details[0].path[0]).toBe('device_token');
    });

    it('accepts valid device_token', () => {
      const { error } = schemas.authenticate.validate({ device_token: 'abc123' });
      expect(error).toBeUndefined();
    });
  });
});
