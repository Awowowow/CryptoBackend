import crypto from "crypto";
import AppError from "../utils/AppError.js";

const getRequiredWebhookSecret = () => {
  const secret = process.env.BITGO_WEBHOOK_SECRET;

  if (!secret) {
    throw new AppError("BITGO_WEBHOOK_SECRET is not configured", 500);
  }

  return secret;
};

const safeCompare = (a, b) => {
  const first = Buffer.from(a, "hex");
  const second = Buffer.from(b, "hex");

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
};

const verifyBitGoWebhookSignature = (req, _res, next) => {
  const signature = req.header("x-signature-sha256");

  if (!signature) {
    throw new AppError("Missing BitGo webhook signature", 401);
  }

  if (!req.rawBody) {
    throw new AppError("Raw webhook body is missing", 500);
  }

  const secret = getRequiredWebhookSecret();

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody)
    .digest("hex");

  const normalizedSignature = signature.replace(/^sha256=/, "");

  if (!safeCompare(expectedSignature, normalizedSignature)) {
    throw new AppError("Invalid BitGo webhook signature", 401);
  }

  next();
};

export default verifyBitGoWebhookSignature;