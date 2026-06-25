import { CustodyProviderType, CustodyWebhookEventStatus } from "@prisma/client";
import { formatUnits } from "ethers";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { processDetectedDeposit } from "../wallet-ledger-service/deposit.service.js";
import { getCustodyTransfer } from "./custodyProvider.service.js";
import { finalizeSubmittedWithdrawal } from "../wallet-ledger-service/withdrawalProcessor.service.js";

const BITGO_COIN_NETWORK_MAP = Object.freeze({
  hteth: "ETH_HOODI",
  tbtc: "BTC_TESTNET",
});

const NETWORK_NATIVE_ASSET_DECIMALS = Object.freeze({
  ETH_HOODI: 18,
  BTC_TESTNET: 8,
});

const CASE_INSENSITIVE_ADDRESS_NETWORKS = new Set([
  "ETH_HOODI",
]);

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

const formatBitGoTransferAmount = ({networkCode,amountBaseUnits,}) => {
  const decimals = NETWORK_NATIVE_ASSET_DECIMALS[networkCode];

  if (!Number.isInteger(decimals)) {
    throw new AppError(
      `Asset decimals are not configured for network ${networkCode}`,
      400
    );
  }

  return formatUnits(amountBaseUnits, decimals);
};

const normalizeCustodyDepositAddress = ({
  networkCode,
  address,
}) => {
  if (!address || typeof address !== "string") {
    throw new AppError("Custody deposit address is required", 400);
  }

  const trimmedAddress = address.trim();

  if (!trimmedAddress) {
    throw new AppError("Custody deposit address is required", 400);
  }

  if (CASE_INSENSITIVE_ADDRESS_NETWORKS.has(networkCode)) {
    return trimmedAddress.toLowerCase();
  }

  return trimmedAddress;
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
    error instanceof Error
      ? error.message
      : "Custody webhook processing failed";

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

const processBitGoReceiveTransferWebhook = async ({
  event,
  networkCode,
  transfer,
}) => {
  if (!["confirmed", "unconfirmed"].includes(transfer.state)) {
    await rejectWebhookEvent({
      eventId: event.id,
      message: `Unsupported BitGo receive transfer state: ${transfer.state}`,
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
    networkCode,
    address: normalizeCustodyDepositAddress({networkCode, address: receivedEntry.address}),
    txHash: transfer.txid,
    eventIndex: 0,
    amount: formatBitGoTransferAmount({
      networkCode,
      amountBaseUnits: receivedAmount,
    }),
    confirmations,
  });

  return {
    resourceType: "deposit",
    deposit,
  };
};

const processBitGoSendTransferWebhook = async ({
  event,
  networkCode,
  transfer,
}) => {
  const lookupConditions = [];

  if (transfer.id && typeof transfer.id === "string") {
    lookupConditions.push({
      providerTransferId: transfer.id,
    });
  }

  const txHash =
    transfer.txid ||
    transfer.txHash ||
    transfer.normalizedTxHash ||
    null;

  if (txHash && typeof txHash === "string") {
    lookupConditions.push({
      txHash,
    });
  }

  if (lookupConditions.length === 0) {
    throw new AppError("BitGo send transfer id or tx hash is required", 400);
  }

  const withdrawal = await prisma.withdrawal.findFirst({
    where: {
      network: {
        code: networkCode,
      },
      OR: lookupConditions,
    },
  });

  if (!withdrawal) {
    await rejectWebhookEvent({
      eventId: event.id,
      message: "Matching CryptoEx withdrawal was not found for BitGo send transfer",
    });
  }

  const withdrawalResult = await finalizeSubmittedWithdrawal({
    withdrawalId: withdrawal.id,
  });

  return {
    resourceType: "withdrawal",
    withdrawal: withdrawalResult,
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

    let result;

    if (transfer.type === "receive") {
      result = await processBitGoReceiveTransferWebhook({
        event,
        networkCode: preparedEvent.networkCode,
        transfer,
      });
    } else if (transfer.type === "send") {
      result = await processBitGoSendTransferWebhook({
        event,
        networkCode: preparedEvent.networkCode,
        transfer,
      });
    } else {
      await rejectWebhookEvent({
        eventId: event.id,
        message: `Unsupported BitGo transfer type: ${transfer.type}`,
      });
    }

    const processedEvent = await markWebhookEventProcessed({
      eventId: event.id,
    });

    return {
      event: processedEvent,
      ...result,
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
