import redisClient from "../config/redis.js";
import { verifyAccessToken } from "../utils/token.js";

const authentication = async (req, res, next) => {
  try {
    const token =
      req.cookies.accessToken ||
      (req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const { userId, sessionId } = decoded;

    const session = await redisClient.get(`access_token:${sessionId}`);

    if (!session || session !== String(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session",
      });
    }

    req.user = { userId, sessionId };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

export default authentication;