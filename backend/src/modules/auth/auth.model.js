'use strict';

const db = require('../../shared/db/knex');

/**
 * Data access layer for auth operations.
 * All DB interactions for users and refresh tokens live here.
 */

/**
 * Insert a new user record.
 * @param {{ id: string, tenantId: string, email: string, passwordHash: string, role: string }} data
 * @returns {Promise<object>} inserted user row
 */
async function createUser(data) {
  const [user] = await db('users')
    .insert({
      id: data.id,
      tenant_id: data.tenantId,
      email: data.email,
      password_hash: data.passwordHash,
      role: data.role || 'installer',
    })
    .returning(['id', 'tenant_id', 'email', 'role', 'created_at']);
  return user;
}

/**
 * Find a user by email within a specific tenant.
 * @param {string} tenantId
 * @param {string} email
 * @returns {Promise<object|undefined>}
 */
async function findUserByEmail(tenantId, email) {
  return db('users').where({ tenant_id: tenantId, email }).first();
}

/**
 * Find a user by their UUID.
 * @param {string} id
 * @returns {Promise<object|undefined>}
 */
async function findUserById(id) {
  return db('users').where({ id }).first();
}

/**
 * Store a refresh token.
 * @param {{ id: string, userId: string, token: string, expiresAt: Date }} data
 * @returns {Promise<object>}
 */
async function createRefreshToken(data) {
  const [row] = await db('refresh_tokens')
    .insert({
      id: data.id,
      user_id: data.userId,
      token: data.token,
      expires_at: data.expiresAt,
    })
    .returning('*');
  return row;
}

/**
 * Look up a refresh token record by token value.
 * @param {string} token
 * @returns {Promise<object|undefined>}
 */
async function findRefreshToken(token) {
  return db('refresh_tokens').where({ token }).first();
}

/**
 * Delete a refresh token by value (logout / rotation).
 * @param {string} token
 * @returns {Promise<number>} number of deleted rows
 */
async function deleteRefreshToken(token) {
  return db('refresh_tokens').where({ token }).delete();
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  createRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
};
