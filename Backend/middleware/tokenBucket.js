import redisClient from "../config/redis.js";
import AppError from "../utils/AppError.js";
import { getClientIp } from "./slidingWindowCounter.js";

const SCALE = 1000;

const tokenBucketScript = `
local key = KEYS[1]

local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillRatePerMsScaled = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local ttlMs = tonumber(ARGV[5])
local scale = tonumber(ARGV[6])

local bucket = redis.call("HMGET", key, "tokensScaled", "updatedAt")

local tokensScaled = tonumber(bucket[1])
local updatedAt = tonumber(bucket[2])

if tokensScaled == nil then
  tokensScaled = capacity * scale
  updatedAt = now
end

local elapsedMs = math.max(0, now - updatedAt)
local refillScaled = math.floor(elapsedMs * refillRatePerMsScaled)

tokensScaled = math.min(capacity * scale, tokensScaled + refillScaled)

local costScaled = cost * scale

if tokensScaled < costScaled then
  redis.call("HMSET", key, "tokensScaled", tokensScaled, "updatedAt", now)
  redis.call("PEXPIRE", key, ttlMs)

  return {
    0,
    tokensScaled,
    capacity * scale
  }
end

tokensScaled = tokensScaled - costScaled

redis.call("HMSET", key, "tokensScaled", tokensScaled, "updatedAt", now)
redis.call("PEXPIRE", key, ttlMs)

return {
  1,
  tokensScaled,
  capacity * scale
}
`;

const createTokenBucketLimiter = ({
  name,
  capacity,
  refillTokens,
  refillIntervalMs,
  cost = 1,
  keyGenerator,
  message = "Too many requests. Please slow down.",
  failClosed = false,
}) => {
  if (!name || typeof name !== "string") {
    throw new Error("Token bucket limiter name is required");
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("Token bucket capacity must be a positive integer");
  }

  if (!Number.isInteger(refillTokens) || refillTokens <= 0) {
    throw new Error("Token bucket refillTokens must be a positive integer");
  }

  if (!Number.isInteger(refillIntervalMs) || refillIntervalMs <= 0) {
    throw new Error("Token bucket refillIntervalMs must be a positive integer");
  }

  if (!Number.isInteger(cost) || cost <= 0) {
    throw new Error("Token bucket cost must be a positive integer");
  }

  return async (req, res, next) => {
    const now = Date.now();

    const identity = keyGenerator ? keyGenerator(req) : getClientIp(req);

    const safeIdentity = String(identity || "unknown").replace(
      /[^a-zA-Z0-9:_-]/g,
      "_"
    );

    const key = `token-bucket:${name}:{${safeIdentity}}`;

    const refillRatePerMsScaled = Math.floor(
      (refillTokens * SCALE) / refillIntervalMs
    );

    const ttlMs = Math.ceil((capacity / refillTokens) * refillIntervalMs * 2);

    let result;

    try {
      result = await redisClient.eval(tokenBucketScript, {
        keys: [key],
        arguments: [
          String(now),
          String(capacity),
          String(refillRatePerMsScaled),
          String(cost),
          String(ttlMs),
          String(SCALE),
        ],
      });
    } catch (error) {
      if (failClosed) {
        throw new AppError("Rate limiter unavailable. Please try again later.", 503);
      }

      return next();
    }

    const [allowed, tokensScaled, capacityScaled] = result;

    const remaining = Math.floor(Number(tokensScaled) / SCALE);
    const limit = Math.floor(Number(capacityScaled) / SCALE);

    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, remaining)));

    if (!Number(allowed)) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((cost * SCALE - Number(tokensScaled)) / refillRatePerMsScaled / 1000)
      );

      res.setHeader("Retry-After", String(retryAfterSeconds));

      throw new AppError(message, 429);
    }

    return next();
  };
};

export { createTokenBucketLimiter };