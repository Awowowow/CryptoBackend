import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { normalizeTradingPairSymbol } from "../../utils/consts.js";

const formatRecentTrade = (trade) => {
  return {
    id: trade.id,
    price: trade.price.toString(),
    quantity: trade.quantity.toString(),
    quoteAmount: trade.quoteAmount.toString(),
    makerSide: trade.makerSide,
    takerSide: trade.takerSide,
    createdAt: trade.createdAt,
  };
};

const getRecentTrades = async ({ symbol, limit = 50 }) => {
  const normalizedSymbol = normalizeTradingPairSymbol(symbol);

  const normalizedLimit = Number(limit);

  if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 100) {
    throw new AppError("Recent trades limit must be between 1 and 100", 400);
  }

  const tradingPair = await prisma.tradingPair.findUnique({
    where: {
      symbol: normalizedSymbol,
    },
  });

  if (!tradingPair || tradingPair.status !== "ACTIVE") {
    throw new AppError("Trading pair is not available", 404);
  }

  const trades = await prisma.trade.findMany({
    where: {
      tradingPairId: tradingPair.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: normalizedLimit,
  });

  return {
    symbol: tradingPair.symbol,
    trades: trades.map(formatRecentTrade),
  };
};

export { getRecentTrades };