import prisma from "../../config/prisma.js";

const formatTradingPair = (tradingPair) => {
  return {
    id: tradingPair.id,
    symbol: tradingPair.symbol,
    status: tradingPair.status,
    baseAsset: {
      id: tradingPair.baseAsset.id,
      symbol: tradingPair.baseAsset.symbol,
      name: tradingPair.baseAsset.name,
      decimals: tradingPair.baseAsset.decimals,
    },
    quoteAsset: {
      id: tradingPair.quoteAsset.id,
      symbol: tradingPair.quoteAsset.symbol,
      name: tradingPair.quoteAsset.name,
      decimals: tradingPair.quoteAsset.decimals,
    },
    priceDecimals: tradingPair.priceDecimals,
    quantityDecimals: tradingPair.quantityDecimals,
    minBaseQuantity: tradingPair.minBaseQuantity.toString(),
    minQuoteAmount: tradingPair.minQuoteAmount.toString(),
  };
};

const getTradingPairs = async () => {
  const tradingPairs = await prisma.tradingPair.findMany({
    where: {
      status: "ACTIVE",
      baseAsset: {
        isActive: true,
      },
      quoteAsset: {
        isActive: true,
      },
    },
    include: {
      baseAsset: true,
      quoteAsset: true,
    },
    orderBy: {
      symbol: "asc",
    },
  });

  return tradingPairs.map(formatTradingPair);
};

export { getTradingPairs };