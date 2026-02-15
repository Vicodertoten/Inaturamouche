// server/utils/auth.js
// Shared authentication helpers — extracted from quiz.js and reports.js

import { timingSafeEqual } from 'node:crypto';

/**
 * Extract bearer token from the Authorization header.
 * @param {import('express').Request} req
 * @returns {string} The token string (empty if absent)
 */
export const getAuthToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header) return '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return header.trim();
};

/**
 * Check whether the request carries a token that matches the expected value.
 * Uses timing-safe comparison to prevent side-channel attacks.
 * @param {import('express').Request} req
 * @param {string} expectedToken
 * @returns {boolean}
 */
export const isAuthorized = (req, expectedToken) => {
  if (!expectedToken) return false;
  const token = getAuthToken(req);
  if (!token || token.length !== expectedToken.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
  } catch {
    return false;
  }
};

/**
 * Check if a value is a non-empty string suitable as a token.
 * @param {*} value
 * @returns {boolean}
 */
export const isConfiguredToken = (value) => typeof value === 'string' && value.trim().length > 0;
