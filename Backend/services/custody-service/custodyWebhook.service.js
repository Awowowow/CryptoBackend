import {
  CustodyProviderType,
  CustodyWebhookEventStatus,
} from "@prisma/client";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";

const ENQUEUEABLE_WEBHOOK_STATUSES = new Set([
  CustodyWebhookEventStatus.RECEIVED,
  CustodyWebhookEventStatus.FAILED,
]);

const receiveBitGoWebhookEvent = async (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AppError("Invalid BitGo webhook payload", 400);
  }

  const externalEventId =
    typeof payload.id === "string" ? payload.id.trim() : "";

  const eventType =
    typeof payload.type === "string" ? payload.type.trim() : "";

  const walletId =
    typeof payload.wallet === "string" ? payload.wallet.trim() : null;

  const transferId =
    typeof payload.transfer === "string" ? payload.transfer.trim() : null;

  const coin =
    typeof payload.coin === "string" ? payload.coin.trim() : null;

  if (!externalEventId || !eventType) {
    throw new AppError("BitGo webhook event id and type are required", 400);
  }

  if (eventType !== "transfer") {
    throw new AppError("Unsupported BitGo webhook event type", 400);
  }

  if (!walletId || !transferId || !coin) {
    throw new AppError("BitGo transfer webhook details are incomplete", 400);
  }

  const existingEvent = await prisma.custodyWebhookEvent.findUnique({
    where: {
      provider_externalEventId: {
        provider: CustodyProviderType.BITGO,
        externalEventId,
      },
    },
  });

  if (existingEvent) {
    return {
      event: existingEvent,
      wasCreated: false,
      shouldEnqueue: ENQUEUEABLE_WEBHOOK_STATUSES.has(existingEvent.status),
    };
  }

  const event = await prisma.custodyWebhookEvent.create({
    data: {
      provider: CustodyProviderType.BITGO,
      externalEventId,
      eventType,
      walletId,
      transferId,
      coin,
      payload,
    },
  });

  return {
    event,
    wasCreated: true,
    shouldEnqueue: true,
  };
};

export { receiveBitGoWebhookEvent };