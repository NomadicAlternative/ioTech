'use strict';

const schemas = require('../auth.schemas');

describe('auth.schemas.installerRegister', () => {
  it('accepts a valid payload with all required fields', () => {
    const { error } = schemas.installerRegister.validate({
      name: 'ACME Installers',
      email: 'installer@example.com',
      password: 'securePass1!',
    });
    expect(error).toBeUndefined();
  });

  it('accepts optional contact_email and metadata', () => {
    const { error } = schemas.installerRegister.validate({
      name: 'ACME Installers',
      email: 'installer@example.com',
      password: 'securePass1!',
      contact_email: 'billing@example.com',
      metadata: { company: 'ACME Inc', taxId: '123-45-6789' },
    });
    expect(error).toBeUndefined();
  });

  it('rejects missing name', () => {
    const { error } = schemas.installerRegister.validate({
      email: 'installer@example.com',
      password: 'securePass1!',
    });
    expect(error).toBeDefined();
    const fields = error.details.map((d) => d.path[0]);
    expect(fields).toContain('name');
  });

  it('rejects missing email', () => {
    const { error } = schemas.installerRegister.validate({
      name: 'ACME Installers',
      password: 'securePass1!',
    });
    expect(error).toBeDefined();
    const fields = error.details.map((d) => d.path[0]);
    expect(fields).toContain('email');
  });

  it('rejects missing password', () => {
    const { error } = schemas.installerRegister.validate({
      name: 'ACME Installers',
      email: 'installer@example.com',
    });
    expect(error).toBeDefined();
    const fields = error.details.map((d) => d.path[0]);
    expect(fields).toContain('password');
  });

  it('rejects invalid email format', () => {
    const { error } = schemas.installerRegister.validate({
      name: 'ACME Installers',
      email: 'not-an-email',
      password: 'securePass1!',
    });
    expect(error).toBeDefined();
  });

  it('rejects short password (< 8 chars)', () => {
    const { error } = schemas.installerRegister.validate({
      name: 'ACME Installers',
      email: 'installer@example.com',
      password: 'short',
    });
    expect(error).toBeDefined();
  });

  it('rejects invalid contact_email format', () => {
    const { error } = schemas.installerRegister.validate({
      name: 'ACME Installers',
      email: 'installer@example.com',
      password: 'securePass1!',
      contact_email: 'not-an-email',
    });
    expect(error).toBeDefined();
  });

  it('rejects empty name', () => {
    const { error } = schemas.installerRegister.validate({
      name: '',
      email: 'installer@example.com',
      password: 'securePass1!',
    });
    expect(error).toBeDefined();
  });

  it('strips unknown fields (e.g. extraField)', () => {
    const { value, error } = schemas.installerRegister.validate(
      {
        name: 'ACME Installers',
        email: 'installer@example.com',
        password: 'securePass1!',
        extraField: 'should-be-stripped',
      },
      { stripUnknown: true }
    );
    expect(error).toBeUndefined();
    expect(value.extraField).toBeUndefined();
  });
});
