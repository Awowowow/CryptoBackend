import { CustodyProviderType, CustodyWebhookEventStatus } from "@prisma/client";
import { formatEther } from "ethers";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { processDetectedDeposit } from "../wallet-ledger-service/deposit.service.js";
import { getCustodyTransfer } from "./custodyProvider.service.js";

const BITGO_COIN_NETWORK_MAP = Object.freeze({
  hteth: "ETH_HOODI",
});

const getNetworkCodeFromBitGoCoin = (coin) => {
  const normalizedCoin = coin.trim().toLowerCase();

  const networkCode = BITGO_COIN_NETWORK_MAP[normalizedCoin];

  if (!networkCode) {
    throw new AppError("Unsupported BitGo webhook coin", 400);
  }

  return networkCode;
};

const parseBitGoIntegerAmount = (valueString) => {
  if (typeof valueString !== "string" || !/^-?\d+$/.test(valueString)) {
    throw new AppError("Invalid BitGo transfer amount", 400);
  }

  return BigInt(valueString);
};

const getReceivedTransferEntry = (transfer) => {
  if (!Array.isArray(transfer.entries)) {
    throw new AppError("BitGo transfer entries are missing", 400);
  }

  const receivedEntry = transfer.entries.find((entry) => {
    const value = parseBitGoIntegerAmount(entry.valueString);

    return entry.wallet && value > 0n;
  });

  if (!receivedEntry) {
    throw new AppError("BitGo receive transfer entry was not found", 400);
  }

  if (!receivedEntry.address || typeof receivedEntry.address !== "string") {
    throw new AppError("BitGo receive transfer address is missing", 400);
  }

  return receivedEntry;
};

const markWebhookEventProcessing = async (eventId) => {
  return prisma.custodyWebhookEvent.update({
    where: {
      id: eventId,
    },
    data: {
      status: CustodyWebhookEventStatus.PROCESSING,
      errorMessage: null,
    },
  });
};

const markWebhookEventProcessed = async ({ eventId }) => {
  return prisma.custodyWebhookEvent.update({
    where: {
      id: eventId,
    },
    data: {
      status: CustodyWebhookEventStatus.PROCESSED,
      processedAt: new Date(),
      errorMessage: null,
    },
  });
};

const markWebhookEventFailed = async ({ eventId, error }) => {
  const message =
    error instanceof Error ? error.message : "Custody webhook processing failed";

  await prisma.custodyWebhookEvent.update({
    where: {
      id: eventId,
    },
    data: {
      status: CustodyWebhookEventStatus.FAILED,
      errorMessage: message,
    },
  });
};

const rejectWebhookEvent = async ({ eventId, message }) => {
  await prisma.custodyWebhookEvent.update({
    where: {
      id: eventId,
    },
    data: {
      status: CustodyWebhookEventStatus.REJECTED,
      errorMessage: message,
    },
  });

  throw new AppError(message, 400);
};

const getBitGoWebhookEventForProcessing = async ({ eventId }) => {
  const event = await prisma.custodyWebhookEvent.findUnique({
    where: {
      id: eventId,
    },
  });

  if (!event) {
    throw new AppError("Custody webhook event not found", 404);
  }

  if (event.provider !== CustodyProviderType.BITGO) {
    throw new AppError("Unsupported custody webhook provider", 400);
  }

  if (event.eventType !== "transfer") {
    throw new AppError("Unsupported custody webhook event type", 400);
  }

  if (!event.coin || !event.transferId) {
    throw new AppError("Custody webhook transfer details are missing", 400);
  }

  if (event.status === CustodyWebhookEventStatus.PROCESSING) {
    throw new AppError("Custody webhook event is already processing", 409);
  }

  if (event.status === CustodyWebhookEventStatus.PROCESSED) {
    throw new AppError("Custody webhook event has already been processed", 409);
  }

  if (event.status === CustodyWebhookEventStatus.REJECTED) {
    throw new AppError("Custody webhook event was rejected", 409);
  }

  const networkCode = getNetworkCodeFromBitGoCoin(event.coin);

  return {
    event,
    networkCode,
  };
};

const fetchTransferForBitGoWebhookEvent = async ({ eventId }) => {
  const { event, networkCode } = await getBitGoWebhookEventForProcessing({
    eventId,
  });

  const transfer = await getCustodyTransfer({
    provider: CustodyProviderType.BITGO,
    networkCode,
    transferId: event.transferId,
  });

  return {
    event,
    networkCode,
    transfer,
  };
};

const processBitGoTransferWebhookEvent = async ({ eventId }) => {
  let event;

  try {
    const preparedEvent = await getBitGoWebhookEventForProcessing({
      eventId,
    });

    event = preparedEvent.event;

    await markWebhookEventProcessing(event.id);

    const transfer = await getCustodyTransfer({
      provider: CustodyProviderType.BITGO,
      networkCode: preparedEvent.networkCode,
      transferId: event.transferId,
    });

    if (transfer.type !== "receive") {
      await rejectWebhookEvent({
        eventId: event.id,
        message: "BitGo transfer is not an incoming receive transfer",
      });
    }

    if (!["confirmed", "unconfirmed"].includes(transfer.state)) {
      await rejectWebhookEvent({
        eventId: event.id,
        message: `Unsupported BitGo transfer state: ${transfer.state}`,
      });
    }

    if (!transfer.txid || typeof transfer.txid !== "string") {
      throw new AppError("BitGo transfer txid is missing", 400);
    }

    const receivedEntry = getReceivedTransferEntry(transfer);
    const receivedAmount = parseBitGoIntegerAmount(receivedEntry.valueString);

    const confirmations = Number(transfer.confirmations ?? 0);

    if (!Number.isInteger(confirmations) || confirmations < 0) {
      throw new AppError("BitGo transfer confirmations are invalid", 400);
    }

    const deposit = await processDetectedDeposit({
      networkCode: preparedEvent.networkCode,
      address: receivedEntry.address.toLowerCase(),
      txHash: transfer.txid,
      eventIndex: 0,
      amount: formatEther(receivedAmount),
      confirmations,
    });

    const processedEvent = await markWebhookEventProcessed({
      eventId: event.id,
    });

    return {
      event: processedEvent,
      deposit,
    };
  } catch (error) {
    if (!event) {
      throw error;
    }

    const latestEvent = await prisma.custodyWebhookEvent.findUnique({
      where: {
        id: event.id,
      },
      select: {
        status: true,
      },
    });

    if (latestEvent?.status === CustodyWebhookEventStatus.REJECTED) {
      throw error;
    }

    await markWebhookEventFailed({
      eventId: event.id,
      error,
    });

    throw error;
  }
};

export { fetchTransferForBitGoWebhookEvent, processBitGoTransferWebhookEvent };