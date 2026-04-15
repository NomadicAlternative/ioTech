'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const authModel = require('./auth.model');
const { validateEmail, validatePassword } = require('../../shared/validators');
const {
  ValidationError,
  UnauthorizedError,
  ConflictError,
} = require('../../shared/errors');
const logger = require('../../shared/logger');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRES = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

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
  if (!validatePassword(password)) throw new ValidationError('Password must be at least 8 characters');

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
  if (!tenantId) throw new ValidationError('tenantId is required');
  if (!email || !password) throw new ValidationError('Email and password are required');

  const user = await authModel.findUserByEmail(tenantId, email);
  if (!user) throw new UnauthorizedError('Invalid credentials');

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw new UnauthorizedError('Invalid credentials');

  const accessToken = signAccessToken({
    userId: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    role: user.role,
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
    role: user.role,
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

module.exports = { register, login, refreshToken, logout };
