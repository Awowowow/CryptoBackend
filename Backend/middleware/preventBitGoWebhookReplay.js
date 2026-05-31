import crypto from "crypto";
import redisClient from "../config/redis.js";
import AppError from "../utils/AppError.js";

const DEFAULT_REPLAY_WINDOW_SECONDS = 300;

const getReplayWindowSeconds = () => {
  const rawValue =
    process.env.BITGO_WEBHOOK_REPLAY_WINDOW_SECONDS ??
    String(DEFAULT_REPLAY_WINDOW_SECONDS);

  const replayWindowSeconds = Number(rawValue);

  if (!Number.isInteger(replayWindowSeconds) || replayWindowSeconds <= 0) {
    throw new AppError(
      "BITGO_WEBHOOK_REPLAY_WINDOW_SECONDS must be a positive integer",
      500
    );
  }

  return replayWindowSeconds;
};

const buildReplayKey = ({ signature, rawBody }) => {
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${signature}:${rawBody}`)
    .digest("hex");

  return `webhook:bitgo:replay:${fingerprint}`;
};

const preventBitGoWebhookReplay = async (req, res, next) => {
  const signature = req.header("x-signature-sha256");

  if (!signature) {
    throw new AppError("Missing BitGo webhook signature", 401);
  }

  if (!req.rawBody) {
    throw new AppError("Raw webhook body is missing", 500);
  }

  const replayWindowSeconds = getReplayWindowSeconds();

  const replayKey = buildReplayKey({
    signature: signature.replace(/^sha256=/, ""),
    rawBody: req.rawBody,
  });

  const setResult = await redisClient.set(replayKey, "1", {
    NX: true,
    EX: replayWindowSeconds,
  });

  if (setResult === null) {
    return res.status(200).json({
      success: true,
      message: "Duplicate webhook ignored",
    });
  }

  next();
};

export default preventBitGoWebhookReplay;