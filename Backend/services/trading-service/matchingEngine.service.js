import {
  TradeOrderSide,
  TradeOrderStatus,
  WalletAccountType,
  LedgerTransactionType,
} from "@prisma/client";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { getOrCreateUserWalletAccounts } from "../wallet-ledger-service/walletAccount.service.js";
import { toDecimal } from "../../utils/decimals.js";
import { postLedgerTransaction } from "../wallet-ledger-service/ledger.service.js";

const MATCHABLE_ORDER_STATUSES = [
  TradeOrderStatus.OPEN,
  TradeOrderStatus.PARTIALLY_FILLED,
];

const getOppositeOpenOrders = async ({ incomingOrder }) => {
  if (!incomingOrder) {
    throw new AppError("Incoming order is required", 400);
  }

  if (!incomingOrder.price) {
    throw new AppError("Incoming order price is required for matching", 400);
  }

  const baseWhere = {
    tradingPairId: incomingOrder.tradingPairId,
    status: {
      in: MATCHABLE_ORDER_STATUSES,
    },
    userId: {
      not: incomingOrder.userId,
    },
  };

  if (incomingOrder.side === TradeOrderSide.BUY) {
    return prisma.tradeOrder.findMany({
      where: {
        ...baseWhere,
        side: TradeOrderSide.SELL,
        price: {
          lte: incomingOrder.price,
        },
      },
      include: {
        tradingPair: true,
        baseAsset: true,
        quoteAsset: true,
        lockedAsset: true,
      },
      orderBy: [
        {
          price: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    });
  }

  if (incomingOrder.side === TradeOrderSide.SELL) {
    return prisma.tradeOrder.findMany({
      where: {
        ...baseWhere,
        side: TradeOrderSide.BUY,
        price: {
          gte: incomingOrder.price,
        },
      },
      include: {
        tradingPair: true,
        baseAsset: true,
        quoteAsset: true,
        lockedAsset: true,
      },
      orderBy: [
        {
          price: "desc",
        },
        {
          createdAt: "asc",
        },
      ],
    });
  }

  throw new AppError("Unsupported incoming order side", 400);
};

const calculateFillQuantity = ({ incomingOrder, oppositeOrder }) => {
  if (!incomingOrder) {
    throw new AppError("Incoming order is required", 400);
  }

  if (!oppositeOrder) {
    throw new AppError("Opposite order is required", 400);
  } 

  const incomingRemainingQuantity = toDecimal(
    incomingOrder.remainingQuantity,
    "Incoming remaining quantity"
  );

  const oppositeRemainingQuantity = toDecimal(
    oppositeOrder.remainingQuantity,
    "Opposite remaining quantity"
  );

  if (incomingRemainingQuantity.lessThanOrEqualTo(0)) {
    throw new AppError("Incoming order has no remaining quantity", 400);
  }

  if (oppositeRemainingQuantity.lessThanOrEqualTo(0)) {
    throw new AppError("Opposite order has no remaining quantity", 400);
  }

  if (incomingRemainingQuantity.lessThanOrEqualTo(oppositeRemainingQuantity)) {
    return incomingRemainingQuantity;
  }

  return oppositeRemainingQuantity;
};

const getExecutionPrice = ({ oppositeOrder }) => {
  if (!oppositeOrder) {
    throw new AppError("Opposite order is required", 400);
  }

  if (!oppositeOrder.price) {
    throw new AppError("Opposite order price is required", 400);
  }

  return toDecimal(oppositeOrder.price, "Execution price");
};

const calculateQuoteAmount = ({ executionPrice, fillQuantity }) => {
  if (!executionPrice) {
    throw new AppError("Execution price is required", 400);
  }

  if (!fillQuantity) {
    throw new AppError("Fill quantity is required", 400);
  }

  const normalizedExecutionPrice = toDecimal(executionPrice, "Execution price");

  const normalizedFillQuantity = toDecimal(fillQuantity, "Fill quantity");

  return normalizedExecutionPrice.times(normalizedFillQuantity);
};

const getTradeParticipants = ({ incomingOrder, oppositeOrder }) => {
  if (!incomingOrder) {
    throw new AppError("Incoming order is required", 400);
  }

  if (!oppositeOrder) {
    throw new AppError("Opposite order is required", 400);
  }

  if (incomingOrder.side === TradeOrderSide.BUY) {
    return {
      buyerUserId: incomingOrder.userId,
      sellerUserId: oppositeOrder.userId,
    };
  }

  if (incomingOrder.side === TradeOrderSide.SELL) {
    return {
      buyerUserId: oppositeOrder.userId,
      sellerUserId: incomingOrder.userId,
    };
  }

  throw new AppError("Unsupported incoming order side", 400);
};

const getMakerAndTakerSides = ({ incomingOrder, oppositeOrder }) => {
  if (!incomingOrder) {
    throw new AppError("Incoming order is required", 400);
  }

  if (!oppositeOrder) {
    throw new AppError("Opposite order is required", 400);
  }

  return {
    makerSide: oppositeOrder.side,
    takerSide: incomingOrder.side,
  };
};

const getOrderStatusAfterFill = ({ remainingQuantity }) => {
  const normalizedRemainingQuantity = toDecimal(
    remainingQuantity,
    "Remaining quantity"
  );

  if (normalizedRemainingQuantity.lessThanOrEqualTo(0)) {
    return TradeOrderStatus.FILLED;
  }

  return TradeOrderStatus.PARTIALLY_FILLED;
};

const calculateOrderFillUpdate = ({ order, fillQuantity }) => {
  if (!order) {
    throw new AppError("Order is required", 400);
  }

  const normalizedFillQuantity = toDecimal(fillQuantity, "Fill quantity");

  if (!normalizedFillQuantity.isPositive()) {
    throw new AppError("Fill quantity must be greater than zero", 400);
  }

  const currentFilledQuantity = toDecimal(
    order.filledQuantity,
    "Current filled quantity"
  );

  const currentRemainingQuantity = toDecimal(
    order.remainingQuantity,
    "Current remaining quantity"
  );

  const nextFilledQuantity = currentFilledQuantity.plus(normalizedFillQuantity);

  const nextRemainingQuantity = currentRemainingQuantity.minus(
    normalizedFillQuantity
  );

  if (nextRemainingQuantity.isNegative()) {
    throw new AppError("Fill quantity exceeds remaining order quantity", 400);
  }

  const nextStatus = getOrderStatusAfterFill({
    remainingQuantity: nextRemainingQuantity,
  });

  return {
    filledQuantity: nextFilledQuantity,
    remainingQuantity: nextRemainingQuantity,
    status: nextStatus,
    filledAt: nextStatus === TradeOrderStatus.FILLED ? new Date() : null,
  };
};

const findWalletAccountByType = ({ walletAccounts, type }) => {
  if (!Array.isArray(walletAccounts)) {
    throw new AppError("Wallet accounts must be an array", 500);
  }

  if (!type) {
    throw new AppError("Wallet account type is required", 500);
  }

  const walletAccount = walletAccounts.find((account) => {
    return account.type === type;
  });

  if (!walletAccount) {
    throw new AppError(`Wallet account ${type} is missing`, 500);
  }

  return walletAccount;
};

const getSettlementWalletAccounts = async ({
  buyerUserId,
  sellerUserId,
  baseAssetId,
  quoteAssetId,
}) => {
  const buyerBaseAccounts = await getOrCreateUserWalletAccounts({
    userId: buyerUserId,
    assetId: baseAssetId,
  });

  const buyerQuoteAccounts = await getOrCreateUserWalletAccounts({
    userId: buyerUserId,
    assetId: quoteAssetId,
  });

  const sellerBaseAccounts = await getOrCreateUserWalletAccounts({
    userId: sellerUserId,
    assetId: baseAssetId,
  });

  const sellerQuoteAccounts = await getOrCreateUserWalletAccounts({
    userId: sellerUserId,
    assetId: quoteAssetId,
  });

  return {
    buyerAvailableBaseAccount: findWalletAccountByType({
      walletAccounts: buyerBaseAccounts,
      type: WalletAccountType.AVAILABLE,
    }),

    buyerLockedQuoteAccount: findWalletAccountByType({
      walletAccounts: buyerQuoteAccounts,
      type: WalletAccountType.LOCKED,
    }),

    sellerLockedBaseAccount: findWalletAccountByType({
      walletAccounts: sellerBaseAccounts,
      type: WalletAccountType.LOCKED,
    }),

    sellerAvailableQuoteAccount: findWalletAccountByType({
      walletAccounts: sellerQuoteAccounts,
      type: WalletAccountType.AVAILABLE,
    }),
  };
};

const postTradeSettlementLedgerTransaction = async ({
  tradeId,
  baseAssetId,
  quoteAssetId,
  fillQuantity,
  quoteAmount,
  settlementAccounts,
  tx,
}) => {
  if (!tradeId) {
    throw new AppError("Trade id is required", 400);
  }

  if (!settlementAccounts) {
    throw new AppError("Settlement accounts are required", 400);
  }

  const normalizedFillQuantity = toDecimal(fillQuantity, "Fill quantity");
  const normalizedQuoteAmount = toDecimal(quoteAmount, "Quote amount");

  await postLedgerTransaction({
    type: LedgerTransactionType.TRADE_SETTLEMENT,
    idempotencyKey: `trade-settlement:${tradeId}`,
    referenceType: "TRADE",
    referenceId: tradeId,
    description: `Settle trade ${tradeId}`,
    entries: [
      {
        walletAccountId: settlementAccounts.sellerLockedBaseAccount.id,
        assetId: baseAssetId,
        amount: normalizedFillQuantity.negated(),
      },
      {
        walletAccountId: settlementAccounts.buyerAvailableBaseAccount.id,
        assetId: baseAssetId,
        amount: normalizedFillQuantity,
      },
      {
        walletAccountId: settlementAccounts.buyerLockedQuoteAccount.id,
        assetId: quoteAssetId,
        amount: normalizedQuoteAmount.negated(),
      },
      {
        walletAccountId: settlementAccounts.sellerAvailableQuoteAccount.id,
        assetId: quoteAssetId,
        amount: normalizedQuoteAmount,
      },
    ],
    tx,
  });
};

const createTradeRecord = async ({
  incomingOrder,
  oppositeOrder,
  executionPrice,
  fillQuantity,
  quoteAmount,
  tradeParticipants,
  makerAndTakerSides,
  tx,
}) => {
  if (!tx) {
    throw new AppError("Database transaction is required", 500);
  }

  const trade = await tx.trade.create({
    data: {
      tradingPairId: incomingOrder.tradingPairId,
      baseAssetId: incomingOrder.baseAssetId,
      quoteAssetId: incomingOrder.quoteAssetId,

      makerOrderId: oppositeOrder.id,
      takerOrderId: incomingOrder.id,

      buyerUserId: tradeParticipants.buyerUserId,
      sellerUserId: tradeParticipants.sellerUserId,

      price: executionPrice,
      quantity: fillQuantity,
      quoteAmount,

      buyerFeeAmount: 0,
      sellerFeeAmount: 0,

      makerSide: makerAndTakerSides.makerSide,
      takerSide: makerAndTakerSides.takerSide,

      idempotencyKey: `trade:${incomingOrder.id}:${oppositeOrder.id}`,
    },
  });

  return trade;
};

const updateMatchedOrdersAfterTrade = async ({
  incomingOrder,
  oppositeOrder,
  fillQuantity,
  tx,
}) => {
  if (!tx) {
    throw new AppError("Database transaction is required", 500);
  }

  const incomingOrderUpdate = calculateOrderFillUpdate({
    order: incomingOrder,
    fillQuantity,
  });

  const oppositeOrderUpdate = calculateOrderFillUpdate({
    order: oppositeOrder,
    fillQuantity,
  });

  const updatedIncomingOrder = await tx.tradeOrder.update({
    where: {
      id: incomingOrder.id,
    },
    data: incomingOrderUpdate,
    include: {
      tradingPair: true,
      baseAsset: true,
      quoteAsset: true,
      lockedAsset: true,
    },
  });

  const updatedOppositeOrder = await tx.tradeOrder.update({
    where: {
      id: oppositeOrder.id,
    },
    data: oppositeOrderUpdate,
    include: {
      tradingPair: true,
      baseAsset: true,
      quoteAsset: true,
      lockedAsset: true,
    },
  });

  return {
    updatedIncomingOrder,
    updatedOppositeOrder,
  };
};

const executeSingleMatch = async ({ incomingOrder, oppositeOrder }) => {
  const fillQuantity = calculateFillQuantity({
    incomingOrder,
    oppositeOrder,
  });

  const executionPrice = getExecutionPrice({
    oppositeOrder,
  });

  const quoteAmount = calculateQuoteAmount({
    executionPrice,
    fillQuantity,
  });

  const tradeParticipants = getTradeParticipants({
    incomingOrder,
    oppositeOrder,
  });

  const makerAndTakerSides = getMakerAndTakerSides({
    incomingOrder,
    oppositeOrder,
  });

  const settlementAccounts = await getSettlementWalletAccounts({
    buyerUserId: tradeParticipants.buyerUserId,
    sellerUserId: tradeParticipants.sellerUserId,
    baseAssetId: incomingOrder.baseAssetId,
    quoteAssetId: incomingOrder.quoteAssetId,
  });

  return prisma.$transaction(async (tx) => {
    const trade = await createTradeRecord({
      incomingOrder,
      oppositeOrder,
      executionPrice,
      fillQuantity,
      quoteAmount,
      tradeParticipants,
      makerAndTakerSides,
      tx,
    });

    await postTradeSettlementLedgerTransaction({
      tradeId: trade.id,
      baseAssetId: incomingOrder.baseAssetId,
      quoteAssetId: incomingOrder.quoteAssetId,
      fillQuantity,
      quoteAmount,
      settlementAccounts,
      tx,
    });

    const updatedOrders = await updateMatchedOrdersAfterTrade({
      incomingOrder,
      oppositeOrder,
      fillQuantity,
      tx,
    });

    return {
      trade,
      ...updatedOrders,
    };
  });
};

const processOrderMatches = async ({ incomingOrder }) => {
  let currentIncomingOrder = incomingOrder;
  const recordedTrades = [];

  while (currentIncomingOrder.remainingQuantity.gt(0)) {
    const oppositeOrders = await getOppositeOpenOrders({
      incomingOrder: currentIncomingOrder,
    });

    if (oppositeOrders.length === 0) {
      break;
    }

    const matchResult = await executeSingleMatch({
      incomingOrder: currentIncomingOrder,
      oppositeOrder: oppositeOrders[0],
    });

    recordedTrades.push(matchResult.trade);
    currentIncomingOrder = matchResult.updatedIncomingOrder;

    if (currentIncomingOrder.status === TradeOrderStatus.FILLED) {
      break;
    }
  }

  return {
    order: currentIncomingOrder,
    recordedTrades,
  };
};

export {
  calculateFillQuantity,
  calculateQuoteAmount,
  createTradeRecord,
  executeSingleMatch,
  getExecutionPrice,
  getMakerAndTakerSides,
  getOppositeOpenOrders,
  getSettlementWalletAccounts,
  getTradeParticipants,
  postTradeSettlementLedgerTransaction,
  processOrderMatches,
  updateMatchedOrdersAfterTrade,
};
