'use strict';

const { ValidationError } = require('../errors');

describe('ValidationError', () => {
  it('has empty details array by default', () => {
    const err = new ValidationError();
    expect(err.details).toEqual([]);
  });

  it('stores provided details array', () => {
    const details = [{ field: 'name', message: '"name" is required' }];
    const err = new ValidationError('Validation failed', details);
    expect(err.details).toEqual(details);
  });

  it('uses default message when none is provided', () => {
    const err = new ValidationError();
    expect(err.message).toBe('Validation failed');
  });

  it('has correct statusCode and code', () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});
