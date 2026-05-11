'use strict';

/**
 * Unit tests for firmware schemas.
 */

const schemas = require('../firmware.schemas');

describe('firmware schemas — check query', () => {
  it('validates when hardware_model is provided', () => {
    const { error, value } = schemas.check.validate({ hardware_model: 'ESP32-S3' }, { stripUnknown: true });
    expect(error).toBeUndefined();
    expect(value.hardware_model).toBe('ESP32-S3');
  });

  it('validates when hardware_model and current are provided', () => {
    const { error, value } = schemas.check.validate(
      { hardware_model: 'ESP32-S3', current: '1.0.0' },
      { stripUnknown: true }
    );
    expect(error).toBeUndefined();
    expect(value.hardware_model).toBe('ESP32-S3');
    expect(value.current).toBe('1.0.0');
  });

  it('rejects when hardware_model is missing', () => {
    const { error } = schemas.check.validate({ current: '1.0.0' }, { stripUnknown: true });
    expect(error).toBeDefined();
    expect(error.details[0].path).toContain('hardware_model');
  });

  it('strips unknown fields from query params', () => {
    const { error, value } = schemas.check.validate(
      { hardware_model: 'ESP32-S3', extra_field: 'should-be-stripped' },
      { stripUnknown: true }
    );
    expect(error).toBeUndefined();
    expect(value.extra_field).toBeUndefined();
  });
});

describe('firmware schemas — triggerOta body', () => {
  it('validates an empty body (no version required)', () => {
    const { error } = schemas.triggerOta.validate({}, { stripUnknown: true });
    expect(error).toBeUndefined();
  });

  it('validates when version is provided', () => {
    const { error, value } = schemas.triggerOta.validate({ version: '2.0.0' }, { stripUnknown: true });
    expect(error).toBeUndefined();
    expect(value.version).toBe('2.0.0');
  });

  it('strips unknown fields', () => {
    const { error, value } = schemas.triggerOta.validate(
      { version: '2.0.0', extra: 'stripped' },
      { stripUnknown: true }
    );
    expect(error).toBeUndefined();
    expect(value.extra).toBeUndefined();
  });
});
