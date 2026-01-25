/**
 * Rate Limiting Middleware (Issue #205)
 *
 * Prevents API abuse and protects against DoS attacks.
 * Uses express-rate-limit for hard limits and express-slow-down for gradual slowdown.
 */

import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { createLogger } from '@claude-mem/shared';

const logger = createLogger('rate-limit');

/**
 * Standard rate limit for general API endpoints
 * 100 requests per minute
 */
export const standardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Disable trust proxy validation - this is a local tool
  validate: { trustProxy: false },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({ error: 'Too many requests, please try again later' });
  },
});

/**
 * Stricter rate limit for expensive operations
 * 20 requests per minute
 */
export const expensiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Rate limit exceeded for expensive operations' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    logger.warn('Expensive operation rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({ error: 'Rate limit exceeded for expensive operations' });
  },
});

/**
 * Search-specific rate limit
 * 30 requests per minute
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Search rate limit exceeded, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    logger.warn('Search rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      query: req.query.q,
    });
    res.status(429).json({ error: 'Search rate limit exceeded, please slow down' });
  },
});

/**
 * Speed limiter - gradually slows down requests instead of blocking
 * After 50 requests, adds 100ms delay per additional request
 */
export const speedLimiter = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 50,
  delayMs: (hits: number) => hits * 100,
  maxDelayMs: 5000, // Max 5 second delay
});

/**
 * Worker spawn rate limit
 * 5 requests per minute
 */
export const workerSpawnLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Worker spawn rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    logger.warn('Worker spawn rate limit exceeded', {
      ip: req.ip,
    });
    res.status(429).json({ error: 'Worker spawn rate limit exceeded' });
  },
});

/**
 * Per-project rate limiter for multi-tenant scenarios
 * 50 requests per minute per project+IP combination
 */
export const projectLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  keyGenerator: (req) => {
    const project = (req.query.project as string) || (req.body?.project as string) || 'default';
    return `${req.ip}:${project}`;
  },
  message: { error: 'Project rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  // Disable validations - this is a local tool, not exposed to the internet
  validate: { trustProxy: false, keyGeneratorIpFallback: false },
});

/**
 * Very strict limiter for auth/admin endpoints
 * 10 requests per minute
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Admin rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    logger.warn('Admin rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({ error: 'Admin rate limit exceeded' });
  },
});
