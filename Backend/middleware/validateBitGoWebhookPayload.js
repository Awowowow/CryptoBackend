import AppError from "../utils/AppError.js";

const REQUIRED_STRING_FIELDS = ["type", "wallet", "transfer", "coin"];

const getStringField = (payload, fieldName) =>{
    const value = payload[fieldName];

    if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`BitGo webhook ${fieldName} is required`, 400);
}

return value.trim();
}

const validateBitGoWebhookPayload = (req, _res, next) =>{
    const payload = req.body;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new AppError("Invalid BitGo webhook payload", 400);
      }
    
    const normalizedPayload = {};

    for (const fieldName of REQUIRED_STRING_FIELDS) {
        normalizedPayload[fieldName] = getStringField(payload, fieldName);
      }
      if (normalizedPayload.type !== "transfer") {
        throw new AppError("Unsupported BitGo webhook event type", 400);
  }

  const headerIdempotencyKey = req.header("idempotency-key");
  const payloadId =
    typeof payload.id === "string" && payload.id.trim()
      ? payload.id.trim()
      : null;

  const normalizedEventId =
    payloadId ||
    (typeof headerIdempotencyKey === "string" && headerIdempotencyKey.trim()
      ? headerIdempotencyKey.trim()
      : [
          normalizedPayload.wallet,
          normalizedPayload.transfer,
          typeof payload.state === "string" ? payload.state.trim() : null,
          typeof payload.hash === "string" ? payload.hash.trim() : null,
        ]
          .filter(Boolean)
          .join(":"));

  if (!normalizedEventId) {
    throw new AppError("BitGo webhook event id is required", 400);
  }

  req.body = {
    ...payload,
    id: normalizedEventId,
    ...normalizedPayload,
  };
  next();
}

export default validateBitGoWebhookPayload
