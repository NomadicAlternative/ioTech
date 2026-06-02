'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const authModel = require('./auth.model');
const db = require('../../shared/db/knex');
const { sendPasswordReset } = require('../../shared/email');
const { validateEmail, validatePassword } = require('../../shared/validators');
const { ValidationError, UnauthorizedError, ConflictError } = require('../../shared/errors');
const logger = require('../../shared/logger');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRES = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Resolve the effective role, elevating to super_admin if the email is in SUPER_ADMIN_EMAILS.
 * This keeps a single source of truth for email-based super-admin access.
 */
function resolveEffectiveRole(dbRole, email) {
  const adminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.includes((email || '').toLowerCase())) {
    return 'super_admin';
  }
  return dbRole;
}

/**
 * Sign a short-lived access JWT.
 * @param {{ userId: string, tenantId: string, email: string, role: string }} payload
 * @returns {string}
 */
function signAccessToken(payload) {
  return jwt.sign(
    {
      userId: payload.userId,
      tenantId: payload.tenantId,
      email: payload.email,
      role: payload.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

/**
 * Sign a long-lived refresh JWT.
 * @param {{ userId: string }} payload
 * @returns {string}
 */
function signRefreshToken(payload) {
  return jwt.sign({ userId: payload.userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });
}

/**
 * Register a new user within a tenant.
 * @param {{ tenantId: string, email: string, password: string, role?: string }} data
 * @returns {Promise<{ user: object }>}
 */
async function register(data) {
  const { tenantId, email, password, role = 'installer' } = data;

  if (!tenantId) throw new ValidationError('tenantId is required');
  if (!validateEmail(email)) throw new ValidationError('Invalid email address');
  if (!validatePassword(password))
    throw new ValidationError('Password must be at least 8 characters');

  // Check for duplicate email within the same tenant
  const existing = await authModel.findUserByEmail(tenantId, email);
  if (existing) throw new ConflictError('Email already registered');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const userId = uuidv4();

  const user = await authModel.createUser({ id: userId, tenantId, email, passwordHash, role });
  logger.info(`[auth.service] New user registered: ${email} (tenant=${tenantId})`);

  return { user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id } };
}

/**
 * Authenticate a user and return access + refresh tokens.
 * @param {string} tenantId
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: object }>}
 */
async function login(tenantId, email, password) {
  if (!email || !password) throw new ValidationError('Email and password are required');

  let user;
  if (tenantId) {
    user = await authModel.findUserByEmail(tenantId, email);
  } else {
    // Resolve tenant from email (single-tenant per email in dev/MVP)
    user = await authModel.findUserByEmailOnly(email);
  }
  if (!user) throw new UnauthorizedError('Invalid credentials');

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw new UnauthorizedError('Invalid credentials');

  const accessToken = signAccessToken({
    userId: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    role: resolveEffectiveRole(user.role, user.email),
  });

  const rawRefreshToken = signRefreshToken({ userId: user.id });
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS);

  await authModel.createRefreshToken({
    id: uuidv4(),
    userId: user.id,
    token: rawRefreshToken,
    expiresAt,
  });

  logger.info(`[auth.service] Login successful: ${email} (tenant=${tenantId})`);

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id },
  };
}

/**
 * Issue a new access token from a valid refresh token.
 * @param {string} token  raw refresh JWT
 * @returns {Promise<{ accessToken: string }>}
 */
async function refreshToken(token) {
  if (!token) throw new ValidationError('Refresh token is required');

  // Verify the JWT itself first
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Also verify it exists in DB (supports revocation)
  const storedToken = await authModel.findRefreshToken(token);
  if (!storedToken) throw new UnauthorizedError('Refresh token not found or already revoked');

  if (new Date(storedToken.expires_at) < new Date()) {
    await authModel.deleteRefreshToken(token);
    throw new UnauthorizedError('Refresh token has expired');
  }

  const user = await authModel.findUserById(decoded.userId);
  if (!user) throw new UnauthorizedError('User no longer exists');

  const accessToken = signAccessToken({
    userId: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    role: resolveEffectiveRole(user.role, user.email),
  });

  return { accessToken };
}

/**
 * Revoke a refresh token (logout).
 * @param {string} token  raw refresh JWT
 * @returns {Promise<void>}
 */
async function logout(token) {
  if (!token) throw new ValidationError('Refresh token is required');
  await authModel.deleteRefreshToken(token);
  logger.info('[auth.service] Refresh token revoked');
}

/**
 * Register a new installer (creates tenant + admin user in one transaction).
 * Returns JWT tokens so the installer is logged in immediately after registration.
 *
 * @param {{ name: string, email: string, password: string, contact_email?: string, metadata?: object }} data
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: object, tenant: object }>}
 */
async function installerRegister(data) {
  const { name, email, password, contact_email: contactEmail, metadata } = data;

  if (!validateEmail(email)) throw new ValidationError('Invalid email address');
  if (!validatePassword(password))
    throw new ValidationError('Password must be at least 8 characters');

  // Check for duplicate email across all users (email must be globally unique)
  const existingUser = await authModel.findUserByEmailOnly(email);
  if (existingUser) throw new ConflictError('Email already registered');

  // Check for duplicate tenant email
  const existingTenant = await db('tenants').where({ email }).first();
  if (existingTenant) throw new ConflictError('A tenant with this email already exists');

  const tenantId = uuidv4();
  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Use a raw transaction (not withTenant) since the tenant doesn't exist yet
  // — RLS policies will apply after the tenant is created
  await db.transaction(async (trx) => {
    // 1. Create tenant with trial grant (TRIAL-003)
    await trx('tenants').insert({
      id: tenantId,
      name,
      email,
      contact_email: contactEmail || null,
      metadata: JSON.stringify(metadata || {}),
      trial_ends_at: trx.raw("NOW() + INTERVAL '3 days'"),
      status: 'trial',
      plan: 'base',
    });

    // 2. Create user (admin role for the installer)
    await trx('users').insert({
      id: userId,
      tenant_id: tenantId,
      email,
      password_hash: passwordHash,
      role: 'admin',
    });
  });

  // Generate tokens
  const accessToken = signAccessToken({
    userId,
    tenantId,
    email,
    role: resolveEffectiveRole('admin', email),
  });

  const rawRefreshToken = signRefreshToken({ userId });
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS);

  await authModel.createRefreshToken({
    id: uuidv4(),
    userId,
    token: rawRefreshToken,
    expiresAt,
  });

  logger.info(`[auth.service] New installer registered: ${email} (tenant=${tenantId})`);

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: { id: userId, email, role: 'admin', tenantId },
    tenant: { id: tenantId, name, email },
  };
}

/**
 * Change the authenticated user's password.
 * Verifies the current password before updating.
 *
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @throws {UnauthorizedError} When current password is incorrect
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await db('users').where({ id: userId }).first();
  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db('users').where({ id: userId }).update({
    password_hash: newHash,
    updated_at: new Date(),
  });

  logger.info(`[auth.service] Password changed for user ${user.email} (${userId})`);
}

/**
 * Generate a new random password and send it by email.
 * Does NOT reveal whether the email exists (prevents enumeration).
 *
 * @param {string} email
 */
async function forgotPassword(email) {
  const user = await db('users').where({ email }).first();
  if (!user) {
    // User not found — silently succeed to prevent email enumeration
    logger.info(`[auth.service] Forgot password requested for unknown email: ${email}`);
    return;
  }

  const newPassword = crypto.randomBytes(10).toString('hex');
  const newHash = await bcrypt.hash(newPassword, 10);

  await db('users').where({ id: user.id }).update({
    password_hash: newHash,
    updated_at: new Date(),
  });

  await sendPasswordReset(email, newPassword);

  logger.info(`[auth.service] Password reset for user ${email} (${user.id})`);
}

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  installerRegister,
  changePassword,
  forgotPassword,
};
