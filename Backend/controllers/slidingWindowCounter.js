import redisClient from "../config/redis.js";
import AppError from "../utils/AppError.js";

const SCALE = 1000;

const slidingWindowCounterScript = `
local currentKey = KEYS[1]
local previousKey = KEYS[2]

local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local scale = tonumber(ARGV[4])

local currentCount = tonumber(redis.call("GET", currentKey) or "0")
local previousCount = tonumber(redis.call("GET", previousKey) or "0")

local currentWindowStart = math.floor(now / windowMs) * windowMs
local elapsedInCurrentWindow = now - currentWindowStart
local remainingPreviousWindowMs = windowMs - elapsedInCurrentWindow

local weightedPreviousScaled = math.floor(
  (previousCount * remainingPreviousWindowMs * scale) / windowMs
)

local estimatedCountScaled = (currentCount * scale) + weightedPreviousScaled
local maxRequestsScaled = maxRequests * scale

if estimatedCountScaled >= maxRequestsScaled then
  return {
    0,
    estimatedCountScaled,
    currentCount,
    previousCount
  }
end

currentCount = redis.call("INCR", currentKey)

if currentCount == 1 then
  redis.call("PEXPIRE", currentKey, windowMs * 2)
end

return {
  1,
  estimatedCountScaled + scale,
  currentCount,
  previousCount
}
`;

const getClientIp = (req) => {
  return req.ip || req.socket?.remoteAddress || "unknown";
};

const createSlidingWindowCounterLimiter = ({
  name,
  windowMs,
  maxRequests,
  keyGenerator,
  message = "Too many requests. Please try again later.",
  failClosed = true,
}) => {
  if (!name || typeof name !== "string") {
    throw new Error("Rate limiter name is required");
  }

  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new Error("Rate limiter windowMs must be a positive integer");
  }

  if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
    throw new Error("Rate limiter maxRequests must be a positive integer");
  }

  return async (req, res, next) => {
    const now = Date.now();
    const currentWindowStart = Math.floor(now / windowMs) * windowMs;
    const previousWindowStart = currentWindowStart - windowMs;
    const resetAt = currentWindowStart + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    const identity = keyGenerator ? keyGenerator(req) : getClientIp(req);

    const safeIdentity = String(identity || "unknown").replace(
      /[^a-zA-Z0-9:_-]/g,
      "_"
    );

    const currentKey = `rate:${name}:{${safeIdentity}}:${currentWindowStart}`;
    const previousKey = `rate:${name}:{${safeIdentity}}:${previousWindowStart}`;

    let result;

    try {
      result = await redisClient.eval(slidingWindowCounterScript, {
        keys: [currentKey, previousKey],
        arguments: [
          String(now),
          String(windowMs),
          String(maxRequests),
          String(SCALE),
        ],
      });
    } catch (error) {
      if (failClosed) {throw new AppError("Rate limiter unavailable. Please try again later.",503);
      }
      return next();
    }

    const [allowed, estimatedCountScaled] = result;
    const estimatedCount = Number(estimatedCountScaled) / SCALE;
    const remaining = Math.max(0, maxRequests - Math.ceil(estimatedCount));

    res.setHeader("RateLimit-Limit", String(maxRequests));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

    if (!Number(allowed)) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      throw new AppError(message, 429);
    }

    return next();
  };
};

export { createSlidingWindowCounterLimiter, getClientIp };
