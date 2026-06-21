import { createSlidingWindowCounterLimiter } from "./slidingWindowCounter.js";

const loginRateLimiter = createSlidingWindowCounterLimiter({
  name: "login",
  windowMs: 10 * 60 * 1000,
  maxRequests: 5,
  keyGenerator: (req) => req.body?.email || req.ip,
  message: "Too many login attempts. Please try again later.",
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

const tradeOrderCreateRateLimiter = createSlidingWindowCounterLimiter({
  name: "trade-order-create",
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: "Too many order requests. Please slow down.",
  failClosed: true,
});

const withdrawalCreateRateLimiter = createSlidingWindowCounterLimiter({
  name: "withdrawal-create",
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: "Too many withdrawal attempts. Please try again later.",
  failClosed: true,
});


export {
  loginRateLimiter,
  passwordResetRateLimiter,
  tradeOrderCreateRateLimiter,
  withdrawalCreateRateLimiter,
};