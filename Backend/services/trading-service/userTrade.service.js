import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";

const getUserTradeSide = ({ trade, userId }) => {
  if (trade.buyerUserId === userId) {
    return "BUY";
  }

  if (trade.sellerUserId === userId) {
    return "SELL";
  }

  throw new AppError("User is not part of this trade", 500);
};

const getUserOrderIdForTrade = ({ trade, userSide }) => {
    if (trade.makerSide === userSide) {
      return trade.makerOrderId;
    }
  
    if (trade.takerSide === userSide) {
      return trade.takerOrderId;
    }
  
    throw new AppError("User order could not be resolved for this trade", 500);
  };

const getUserFeeForTrade = ({ trade, userId }) => {
  if (trade.buyerUserId === userId) {
    return trade.buyerFeeAmount;
  }

  if (trade.sellerUserId === userId) {
    return trade.sellerFeeAmount;
  }

  throw new AppError("User is not part of this trade", 500);
};

const formatUserTrade = ({ trade, userId }) => {
    const userSide = getUserTradeSide({
      trade,
      userId,
    });
  
    return {
      id: trade.id,
      symbol: trade.tradingPair.symbol,
      side: userSide,
      orderId: getUserOrderIdForTrade({
        trade,
        userSide,
      }),
      price: trade.price.toString(),
      quantity: trade.quantity.toString(),
      quoteAmount: trade.quoteAmount.toString(),
      feeAmount: getUserFeeForTrade({
        trade,
        userId,
      }).toString(),
      makerSide: trade.makerSide,
      takerSide: trade.takerSide,
      createdAt: trade.createdAt,
    };
  };

const getUserTrades = async ({ userId, symbol = null, limit = 50 }) => {
  if (!userId || typeof userId !== "string") {
    throw new AppError("Authenticated user is required", 401);
  }

  const normalizedLimit = Number(limit);

  if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 100) {
    throw new AppError("Trade history limit must be between 1 and 100", 400);
  }

  const where = {
    OR: [
      {buyerUserId: userId},
      {sellerUserId: userId},
    ],
  };

  if (symbol) {
    const normalizedSymbol = symbol.trim().toUpperCase();

    where.tradingPair = {
      symbol: normalizedSymbol,
    };
  }

  const trades = await prisma.trade.findMany({
    where,
    include: {
      tradingPair: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: normalizedLimit,
  });

  return trades.map((trade) => {
    return formatUserTrade({
      trade,
      userId,
    });
  });
};

export { getUserTrades };