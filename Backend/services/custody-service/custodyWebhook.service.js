import { CustodyProviderType } from "@prisma/client";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";

const receiveBitGoWebhookEvent = async (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AppError("Invalid BitGo webhook payload", 400);
  }
  const externalEventId = typeof payload.id === "string" ? payload.id.trim() : "";

  const eventType = typeof payload.type === "string" ? payload.type.trim() : "";

  const walletId = typeof payload.wallet === "string" ? payload.wallet.trim() : null;

  const transferId = typeof payload.transfer === "string" ? payload.transfer.trim() : null;

  const coin = typeof payload.coin === "string" ? payload.coin.trim() : null;

  if (!externalEventId || !eventType) {
    throw new AppError("BitGo webhook event id and type are required", 400);
  }

  if (eventType !== "transfer") {
    throw new AppError("Unsupported BitGo webhook event type", 400);
  }

  if (!walletId || !transferId || !coin) {
    throw new AppError("BitGo transfer webhook details are incomplete", 400);
  }

  return prisma.custodyWebhookEvent.upsert({
    where: {
      provider_externalEventId: {
        provider: CustodyProviderType.BITGO,
        externalEventId,
      },
    },
    update: {},
    create: {
      provider: CustodyProviderType.BITGO,
      externalEventId,
      eventType,
      walletId,
      transferId,
      coin,
      payload,
    },
  });
};

export { receiveBitGoWebhookEvent };
