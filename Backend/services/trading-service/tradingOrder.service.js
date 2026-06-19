import {
  LedgerTransactionType,
  TradeOrderSide,
  TradeOrderStatus,
  TradeOrderType,
  TradeOrderTimeInForce,
  WalletAccountType,
} from "@prisma/client";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { toDecimal } from "../../utils/decimals.js";
import { postLedgerTransaction } from "../wallet-ledger-service/ledger.service.js";
import { getOrCreateUserWalletAccounts } from "../wallet-ledger-service/walletAccount.service.js";
import { processOrderMatches } from "./matchingEngine.service.js";

const CANCELLABLE_ORDER_STATUSES = [
    TradeOrderStatus.OPEN,
    TradeOrderStatus.PARTIALLY_FILLED,
];

const formatTradeOrder = (order) => {
  return {
    id: order.id,
    symbol: order.tradingPair.symbol,
    side: order.side,
    type: order.type,
    status: order.status,
    timeInForce: order.timeInForce,
    price: order.price?.toString() ?? null,
    originalQuantity: order.originalQuantity.toString(),
    filledQuantity: order.filledQuantity.toString(),
    remainingQuantity: order.remainingQuantity.toString(),
    lockedAmount: order.lockedAmount.toString(),
    releasedAmount: order.releasedAmount.toString(),
    baseAsset: {
      id: order.baseAsset.id,
      symbol: order.baseAsset.symbol,
      name: order.baseAsset.name,
      decimals: order.baseAsset.decimals,
    },
    quoteAsset: {
      id: order.quoteAsset.id,
      symbol: order.quoteAsset.symbol,
      name: order.quoteAsset.name,
      decimals: order.quoteAsset.decimals,
    },
    lockedAsset: {
      id: order.lockedAsset.id,
      symbol: order.lockedAsset.symbol,
      name: order.lockedAsset.name,
      decimals: order.lockedAsset.decimals,
    },
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    filledAt: order.filledAt,
    cancelledAt: order.cancelledAt,
    rejectedAt: order.rejectedAt,
    expiredAt: order.expiredAt,
  };
};

const normalizeOrderInput = ({
  symbol,
  side,
  type,
  price,
  quantity,
  timeInForce = TradeOrderTimeInForce.GTC,
  idempotencyKey,
}) => {
  if (!symbol || typeof symbol !== "string") {
    throw new AppError("Trading pair symbol is required", 400);
  }

  if (!side || typeof side !== "string") {
    throw new AppError("Order side is required", 400);
  }

  if (!type || typeof type !== "string") {
    throw new AppError("Order type is required", 400);
  }

  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new AppError("Order idempotency key is required", 400);
  }

  const normalizedSymbol = symbol.trim().toUpperCase();
  const normalizedSide = side.trim().toUpperCase();
  const normalizedType = type.trim().toUpperCase();
  const normalizedTimeInForce =
    typeof timeInForce === "string"
      ? timeInForce.trim().toUpperCase()
      : timeInForce;

  if (!Object.values(TradeOrderSide).includes(normalizedSide)) {
    throw new AppError("Invalid order side", 400);
  }

  if (!Object.values(TradeOrderType).includes(normalizedType)) {
    throw new AppError("Invalid order type", 400);
  }

  if (!Object.values(TradeOrderTimeInForce).includes(normalizedTimeInForce)) {
    throw new AppError("Invalid order time in force", 400);
  }

  if (normalizedType !== TradeOrderType.LIMIT) {
    throw new AppError("Only limit orders are supported right now", 400);
  }

  const normalizedPrice = toDecimal(price, "Order price");
  const normalizedQuantity = toDecimal(quantity, "Order quantity");

  if (!normalizedPrice.isPositive()) {
    throw new AppError("Order price must be greater than zero", 400);
  }

  if (!normalizedQuantity.isPositive()) {
    throw new AppError("Order quantity must be greater than zero", 400);
  }

  return {
    symbol: normalizedSymbol,
    side: normalizedSide,
    type: normalizedType,
    price: normalizedPrice,
    quantity: normalizedQuantity,
    timeInForce: normalizedTimeInForce,
    idempotencyKey,
  };
};

const calculateOrderLock = ({ tradingPair, side, price, quantity }) => {
    if (side === TradeOrderSide.BUY) {
      return {
        lockedAssetId: tradingPair.quoteAssetId,
        lockedAmount: price.times(quantity),
      };
    }
  
    if (side === TradeOrderSide.SELL) {
      return {
        lockedAssetId: tradingPair.baseAssetId,
        lockedAmount: quantity,
      };
    }
  
    throw new AppError("Unsupported order side", 400);
  };

const calculateRemainingLockedAmount = ({ order }) => {
    if (!order) {
      throw new AppError("Trade order is required", 400);
    }
  
    const lockedAmount = toDecimal(order.lockedAmount, "Locked amount");
    const releasedAmount = toDecimal(order.releasedAmount, "Released amount");
    const filledQuantity = toDecimal(order.filledQuantity, "Filled quantity");
  
    let consumedLockedAmount;
  
    if (order.side === TradeOrderSide.BUY) {
      const price = toDecimal(order.price, "Order price");
      consumedLockedAmount = filledQuantity.times(price);
    } else if (order.side === TradeOrderSide.SELL) {
      consumedLockedAmount = filledQuantity;
    } else {
      throw new AppError("Unsupported order side", 400);
    }
  
    const remainingLockedAmount = lockedAmount
      .minus(consumedLockedAmount)
      .minus(releasedAmount);
  
    if (remainingLockedAmount.isNegative()) {
      throw new AppError("Released or consumed amount exceeds locked amount", 500);
    }
  
    return remainingLockedAmount;
  };

const getRequiredWalletAccountsForLock = async ({ userId, assetId }) => {
    const walletAccounts = await getOrCreateUserWalletAccounts({
      userId,
      assetId,
    });
  
    const availableWalletAccount = walletAccounts.find(
      (walletAccount) => walletAccount.type === WalletAccountType.AVAILABLE
    );
  
    const lockedWalletAccount = walletAccounts.find(
      (walletAccount) => walletAccount.type === WalletAccountType.LOCKED
    );
  
    if (!availableWalletAccount || !lockedWalletAccount) {
      throw new AppError("User wallet accounts are missing", 500);
    }
  
    return {
      availableWalletAccount,
      lockedWalletAccount,
    };
  };

const createTradeOrder = async ({
    userId,
    symbol,
    side,
    type,
    price,
    quantity,
    timeInForce,
    idempotencyKey,
  }) => {
    if (!userId || typeof userId !== "string") {
      throw new AppError("Authenticated user is required", 401);
    }
  
    const normalizedInput = normalizeOrderInput({
      symbol,
      side,
      type,
      price,
      quantity,
      timeInForce,
      idempotencyKey,
    });
  
    const existingOrder = await prisma.tradeOrder.findUnique({
      where: {
        idempotencyKey: normalizedInput.idempotencyKey,
      },
      include: {
        tradingPair: true,
        baseAsset: true,
        quoteAsset: true,
        lockedAsset: true,
      },
    });
  
    if (existingOrder) {
        return {
          order: formatTradeOrder(existingOrder),
          recordedTrades: [],
        };
      }
  
    const tradingPair = await prisma.tradingPair.findUnique({
      where: {
        symbol: normalizedInput.symbol,
      },
      include: {
        baseAsset: true,
        quoteAsset: true,
      },
    });
  
    if (!tradingPair || tradingPair.status !== "ACTIVE") {
      throw new AppError("Trading pair is not available", 404);
    }
  
    if (!tradingPair.baseAsset.isActive || !tradingPair.quoteAsset.isActive) {
      throw new AppError("Trading pair assets are not active", 400);
    }
  
    if (normalizedInput.quantity.lessThan(tradingPair.minBaseQuantity)) {
      throw new AppError("Order quantity is below minimum base quantity", 400);
    }
  
    const quoteAmount = normalizedInput.price.times(normalizedInput.quantity);
  
    if (quoteAmount.lessThan(tradingPair.minQuoteAmount)) {
      throw new AppError("Order value is below minimum quote amount", 400);
    }
  
    const orderLock = calculateOrderLock({
      tradingPair,
      side: normalizedInput.side,
      price: normalizedInput.price,
      quantity: normalizedInput.quantity,
    });
  
    const { availableWalletAccount, lockedWalletAccount } =
      await getRequiredWalletAccountsForLock({
        userId,
        assetId: orderLock.lockedAssetId,
      });
  
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.tradeOrder.create({
        data: {
          userId,
          tradingPairId: tradingPair.id,
          baseAssetId: tradingPair.baseAssetId,
          quoteAssetId: tradingPair.quoteAssetId,
          side: normalizedInput.side,
          type: normalizedInput.type,
          status: TradeOrderStatus.OPEN,
          timeInForce: normalizedInput.timeInForce,
          price: normalizedInput.price,
          originalQuantity: normalizedInput.quantity,
          filledQuantity: 0,
          remainingQuantity: normalizedInput.quantity,
          lockedAssetId: orderLock.lockedAssetId,
          lockedAmount: orderLock.lockedAmount,
          releasedAmount: 0,
          idempotencyKey: normalizedInput.idempotencyKey,
        },
        include: {
          tradingPair: true,
          baseAsset: true,
          quoteAsset: true,
          lockedAsset: true,
        },
      });
  
      await postLedgerTransaction({
        type: LedgerTransactionType.FUNDS_LOCK,
        idempotencyKey: `trade-order-lock:${createdOrder.id}`,
        referenceType: "TRADE_ORDER",
        referenceId: createdOrder.id,
        description: `Lock funds for trade order ${createdOrder.id}`,
        entries: [
          {
            walletAccountId: availableWalletAccount.id,
            assetId: orderLock.lockedAssetId,
            amount: orderLock.lockedAmount.negated(),
          },
          {
            walletAccountId: lockedWalletAccount.id,
            assetId: orderLock.lockedAssetId,
            amount: orderLock.lockedAmount,
          },
        ],
        tx,
      });
  
      return createdOrder;
    });

    const matchResult = await processOrderMatches({
        incomingOrder: order,
      });
      
      return {
        order: formatTradeOrder(matchResult.order),
        recordedTrades: matchResult.recordedTrades,
      };
  };

const cancelTradeOrder = async ({ userId, orderId }) => {
    if (!userId || typeof userId !== "string") {
      throw new AppError("Authenticated user is required", 401);
    }
  
    if (!orderId || typeof orderId !== "string") {
      throw new AppError("Trade order id is required", 400);
    }
  
    const order = await prisma.tradeOrder.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        tradingPair: true,
        baseAsset: true,
        quoteAsset: true,
        lockedAsset: true,
      },
    });
  
    if (!order) {
      throw new AppError("Trade order not found", 404);
    }
  
    if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
      throw new AppError("Trade order cannot be cancelled", 400);
    }
  
    const amountToUnlock = calculateRemainingLockedAmount({
      order,
    });
  
    if (amountToUnlock.lessThanOrEqualTo(0)) {
      throw new AppError("Trade order has no locked funds to release", 400);
    }
  
    const { availableWalletAccount, lockedWalletAccount } =
      await getRequiredWalletAccountsForLock({
        userId,
        assetId: order.lockedAssetId,
      });

    const cancelledOrder = await prisma.$transaction(async (tx) => {
      await postLedgerTransaction({
        type: LedgerTransactionType.FUNDS_UNLOCK,
        idempotencyKey: `trade-order-cancel:${order.id}`,
        referenceType: "TRADE_ORDER",
        referenceId: order.id,
        description: `Cancel trade order ${order.id}`,
        entries: [
          {
            walletAccountId: lockedWalletAccount.id,
            assetId: order.lockedAssetId,
            amount: amountToUnlock.negated(),
          },
          {
            walletAccountId: availableWalletAccount.id,
            assetId: order.lockedAssetId,
            amount: amountToUnlock,
          },
        ],
        tx,
      });
  
      return tx.tradeOrder.update({
        where: {
          id: order.id,
        },
        data: {
          status: TradeOrderStatus.CANCELLED,
          releasedAmount: order.releasedAmount.plus(amountToUnlock),
          cancelledAt: new Date(),
        },
        include: {
          tradingPair: true,
          baseAsset: true,
          quoteAsset: true,
          lockedAsset: true,
        },
      });
    });
  
    return formatTradeOrder(cancelledOrder);
  };

const getUserTradeOrders = async ({ userId, status = null }) => {
    if (!userId || typeof userId !== "string") {
      throw new AppError("Authenticated user is required", 401);
    }
  
    const where = {
      userId,
    };
  
    if (status) {
      const normalizedStatus = status.trim().toUpperCase();
  
      if (!Object.values(TradeOrderStatus).includes(normalizedStatus)) {
        throw new AppError("Invalid order status", 400);
      }
  
      where.status = normalizedStatus;
    }
  
    const orders = await prisma.tradeOrder.findMany({
      where,
      include: {
        tradingPair: true,
        baseAsset: true,
        quoteAsset: true,
        lockedAsset: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  
    return orders.map(formatTradeOrder);
  };

export { createTradeOrder, getUserTradeOrders, cancelTradeOrder };