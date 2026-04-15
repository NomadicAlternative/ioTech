'use strict';

/**
 * Pure validation utilities — no side effects, no middleware.
 * Return boolean; callers decide what to do with the result.
 */

/**
 * Validates an email address (RFC 5322 simplified).
 * @param {string} email
 * @returns {boolean}
 */
function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Validates a password — minimum 8 characters.
 * Additional complexity rules can be added here without changing callers.
 * @param {string} password
 * @returns {boolean}
 */
function validatePassword(password) {
  if (typeof password !== 'string') return false;
  return password.length >= 8;
}

/**
 * Validates a UUID v4 (case-insensitive).
 * @param {string} uuid
 * @returns {boolean}
 */
function validateUUID(uuid) {
  if (typeof uuid !== 'string') return false;
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return re.test(uuid);
}

module.exports = { validateEmail, validatePassword, validateUUID };
