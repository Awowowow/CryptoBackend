import { createSlidingWindowCounterLimiter } from "./slidingWindowCounter.js";

// Auth

const loginShortRateLimiter = createSlidingWindowCounterLimiter({
  name: "login-short",
  windowMs: 60 * 1000,
  maxRequests: 5,
  keyGenerator: (req) => req.body?.email || req.ip,
  message: "Too many login attempts. Please slow down.",
  failClosed: true,
});

const loginLongRateLimiter = createSlidingWindowCounterLimiter({
  name: "login-long",
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyGenerator: (req) => req.body?.email || req.ip,
  message: "Too many login attempts. Please try again later.",
  failClosed: true,
});

const signupRateLimiter = createSlidingWindowCounterLimiter({
  name: "signup",
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyGenerator: (req) => req.body?.email || req.ip,
  message: "Too many signup attempts. Please try again later.",
  failClosed: true,
});

const emailVerifyRateLimiter = createSlidingWindowCounterLimiter({
  name: "email-verify",
  windowMs: 10 * 60 * 1000,
  maxRequests: 20,
  keyGenerator: (req) => req.ip,
  message: "Too many email verification attempts. Please try again later.",
  failClosed: true,
});

const passwordResetRateLimiter = createSlidingWindowCounterLimiter({
  name: "password-reset",
  windowMs: 15 * 60 * 1000,
  maxRequests: 3,
  keyGenerator: (req) => req.body?.email || req.ip,
  message: "Too many password reset attempts. Please try again later.",
  failClosed: true,
});

const twoFaVerifyRateLimiter = createSlidingWindowCounterLimiter({
  name: "two-fa-verify",
  windowMs: 10 * 60 * 1000,
  maxRequests: 10,
  keyGenerator: (req) => req.body?.twoFaToken || req.user?.userId || req.ip,
  message: "Too many 2FA attempts. Please try again later.",
  failClosed: true,
});

// KYC

const kycSubmitRateLimiter = createSlidingWindowCounterLimiter({
  name: "kyc-submit",
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: "Too many KYC submission attempts. Please try again later.",
  failClosed: true,
});

const kycUploadRateLimiter = createSlidingWindowCounterLimiter({
  name: "kyc-upload",
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: "Too many KYC upload attempts. Please try again later.",
  failClosed: true,
});

// Wallet / Withdrawals

const withdrawalCreateRateLimiter = createSlidingWindowCounterLimiter({
  name: "withdrawal-create",
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: "Too many withdrawal attempts. Please try again later.",
  failClosed: true,
});

// Trading

const tradeOrderCreateRateLimiter = createSlidingWindowCounterLimiter({
  name: "trade-order-create",
  windowMs: 60 * 1000,
  maxRequests: 120,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: "Too many order requests. Please slow down.",
  failClosed: true,
});

// Admin

const adminActionRateLimiter = createSlidingWindowCounterLimiter({
  name: "admin-action",
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: "Too many admin requests. Please slow down.",
  failClosed: true,
});

export {
  adminActionRateLimiter,
  emailVerifyRateLimiter,
  kycSubmitRateLimiter,
  kycUploadRateLimiter,
  loginLongRateLimiter,
  loginShortRateLimiter,
  passwordResetRateLimiter,
  signupRateLimiter,
  tradeOrderCreateRateLimiter,
  twoFaVerifyRateLimiter,
  withdrawalCreateRateLimiter,
};