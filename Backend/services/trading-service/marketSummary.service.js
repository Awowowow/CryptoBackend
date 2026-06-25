import prisma from "../../config/prisma.js";
import redisClient from "../../config/redis.js";
import AppError from "../../utils/AppError.js";
import { normalizeTradingPairSymbol } from "../../utils/consts.js";
import { toDecimal } from "../../utils/decimals.js";
import { getMarketTickerCacheKey } from "../market-data-service/marketProjection.service.js";


const MARKET_SUMMARY_WINDOW_HOURS = 24;

const getMarketSummaryWindowStart = () => {
  return new Date(Date.now() - MARKET_SUMMARY_WINDOW_HOURS * 60 * 60 * 1000);
};

const buildEmptyMarketStats = () => {
  return {
    highPrice: null,
    lowPrice: null,
    baseVolume: toDecimal(0, "Base volume"),
    quoteVolume: toDecimal(0, "Quote volume"),
    openPrice: null,
    tradeCount: 0,
  };
};

const calculateMarketStats = ({ trades }) => {
  if (trades.length === 0) {
    return buildEmptyMarketStats();
  }

  let highPrice = toDecimal(trades[0].price, "High price");
  let lowPrice = toDecimal(trades[0].price, "Low price");
  let baseVolume = toDecimal(0, "Base volume");
  let quoteVolume = toDecimal(0, "Quote volume");

  for (const trade of trades) {
    const tradePrice = toDecimal(trade.price, "Trade price");
    const tradeQuantity = toDecimal(trade.quantity, "Trade quantity");
    const tradeQuoteAmount = toDecimal(trade.quoteAmount, "Trade quote amount");

    if (tradePrice.greaterThan(highPrice)) {
      highPrice = tradePrice;
    }

    if (tradePrice.lessThan(lowPrice)) {
      lowPrice = tradePrice;
    }

    baseVolume = baseVolume.plus(tradeQuantity);
    quoteVolume = quoteVolume.plus(tradeQuoteAmount);
  }

  return {
    highPrice,
    lowPrice,
    baseVolume,
    quoteVolume,
    openPrice: toDecimal(trades[0].price, "Open price"),
    tradeCount: trades.length,
  };
};

const calculatePriceChange = ({ lastPrice, openPrice }) => {
  if (!lastPrice || !openPrice) {
    return {
      priceChange: null,
      priceChangePercent: null,
    };
  }

  const priceChange = lastPrice.minus(openPrice);

  if (openPrice.isZero()) {
    return {
      priceChange,
      priceChangePercent: null,
    };
  }

  return {
    priceChange,
    priceChangePercent: priceChange.div(openPrice).times(100),
  };
};

const formatDecimalOrNull = (value) => {
  return value ? value.toString() : null;
};

const getReferenceTickerSnapshot = async ({ symbol }) => {
  const redisKey = getMarketTickerCacheKey(symbol);

  const rawTickerSnapshot = await redisClient.get(redisKey);

  if (!rawTickerSnapshot) {
    return null;
  }

  return JSON.parse(rawTickerSnapshot);
};

const buildReferenceMarketSummary = ({
  tradingPair,
  tickerSnapshot,
  windowStart,
  now,
}) => {
  return {
    symbol: tradingPair.symbol,
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
    window: {
      hours: MARKET_SUMMARY_WINDOW_HOURS,
      from: windowStart,
      to: now,
    },
    lastPrice: tickerSnapshot.lastPrice ?? null,
    highPrice: tickerSnapshot.high24h ?? null,
    lowPrice: tickerSnapshot.low24h ?? null,
    baseVolume: tickerSnapshot.baseVolume24h ?? "0",
    quoteVolume: tickerSnapshot.quoteVolume24h ?? "0",
    priceChange: tickerSnapshot.priceChange ?? null,
    priceChangePercent: tickerSnapshot.priceChangePercent ?? null,
    tradeCount: 0,
    source: "REFERENCE_MARKET",
  };
};


const getMarketSummary = async ({ symbol }) => {
  const normalizedSymbol = normalizeTradingPairSymbol(symbol);
  const windowStart = getMarketSummaryWindowStart();
  const now = new Date();

  const tradingPair = await prisma.tradingPair.findUnique({
    where: {
      symbol: normalizedSymbol,
    },
    include: {
      baseAsset: true,
      quoteAsset: true,
    },
  });

  if (!tradingPair || tradingPair.status !== "ACTIVE") {
    throw new AppError("Trading pair is not available", 404);
  }

  const [lastTrade, tradesInWindow] = await Promise.all([
    prisma.trade.findFirst({
      where: {
        tradingPairId: tradingPair.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.trade.findMany({
      where: {
        tradingPairId: tradingPair.id,
        createdAt: {
          gte: windowStart,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        price: true,
        quantity: true,
        quoteAmount: true,
        createdAt: true,
      },
    }),
  ]);

  const stats = calculateMarketStats({
    trades: tradesInWindow,
  });

  if (!lastTrade && tradesInWindow.length === 0) {
    const tickerSnapshot = await getReferenceTickerSnapshot({
      symbol: tradingPair.symbol,
    });
  
    if (tickerSnapshot) {
      return buildReferenceMarketSummary({
        tradingPair,
        tickerSnapshot,
        windowStart,
        now,
      });
    }
  }

  const lastPrice = lastTrade
    ? toDecimal(lastTrade.price, "Last price")
    : null;

  const { priceChange, priceChangePercent } = calculatePriceChange({
    lastPrice,
    openPrice: stats.openPrice,
  });

  return {
    symbol: tradingPair.symbol,
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
    window: {
      hours: MARKET_SUMMARY_WINDOW_HOURS,
      from: windowStart,
      to: now,
    },
    lastPrice: formatDecimalOrNull(lastPrice),
    highPrice: formatDecimalOrNull(stats.highPrice),
    lowPrice: formatDecimalOrNull(stats.lowPrice),
    baseVolume: stats.baseVolume.toString(),
    quoteVolume: stats.quoteVolume.toString(),
    priceChange: formatDecimalOrNull(priceChange),
    priceChangePercent: formatDecimalOrNull(priceChangePercent),
    tradeCount: stats.tradeCount,
  };
};

export { getMarketSummary };