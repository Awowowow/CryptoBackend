import jwt from "jsonwebtoken";
import redisClient from "../config/redis.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRY = 15 * 60; // 15 minutes in seconds
const REFRESH_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT secrets are not configured");
}

export const signAccessToken = async (userId, sessionId) => {
  const token = jwt.sign({ userId, sessionId }, ACCESS_SECRET, {
    expiresIn: "15m",
  });
  await redisClient.setEx(`access_token:${sessionId}`, ACCESS_EXPIRY, String(userId));
  return token;
};

export const signRefreshToken = async (userId, sessionId) => {
  const token = jwt.sign({ userId, sessionId }, REFRESH_SECRET, {
    expiresIn: "7d",
  });
  await redisClient.setEx(`refresh_token:${sessionId}`, REFRESH_EXPIRY, userId);
  return token;
};

export const verifyAccessToken = (token) => jwt.verify(token, ACCESS_SECRET);

export const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_SECRET);

export const isTokenBlacklisted = async (sessionId) => {
  const result = await redisClient.get(`access_token:${sessionId}`);
  return result === null; // If not in Redis, it's blacklisted/expired
};

export const revokeToken = async (sessionId) => {
  await redisClient.del(`access_token:${sessionId}`);
};

export const revokeRefreshToken = async (sessionId) => {
  await redisClient.del(`refresh_token:${sessionId}`);
};
