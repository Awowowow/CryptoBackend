import { MarketCandleSource } from "@prisma/client";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { normalizeTradingPairSymbol } from "../../utils/consts.js";
import { toDecimal } from "../../utils/decimals.js";


const CandleInterval = Object.freeze({
  ONE_MINUTE: "1m",
  FIVE_MINUTES: "5m",
  FIFTEEN_MINUTES: "15m",
  ONE_HOUR: "1h",
  ONE_DAY: "1d",
});

const CANDLE_INTERVAL_MS = Object.freeze({
  [CandleInterval.ONE_MINUTE]: 60 * 1000,
  [CandleInterval.FIVE_MINUTES]: 5 * 60 * 1000,
  [CandleInterval.FIFTEEN_MINUTES]: 15 * 60 * 1000,
  [CandleInterval.ONE_HOUR]: 60 * 60 * 1000,
  [CandleInterval.ONE_DAY]: 24 * 60 * 60 * 1000,
});

const DEFAULT_CANDLE_INTERVALS = Object.freeze([
  CandleInterval.ONE_MINUTE,
  CandleInterval.FIVE_MINUTES,
  CandleInterval.FIFTEEN_MINUTES,
  CandleInterval.ONE_HOUR,
  CandleInterval.ONE_DAY,
]);

const CandleRange = Object.freeze({
  ONE_HOUR: "1h",
  ONE_DAY: "24h",
  SEVEN_DAYS: "7d",
  THIRTY_DAYS: "30d",
  THREE_MONTHS: "3m",
  ONE_YEAR: "1y",
  THREE_YEARS: "3y",
  FIVE_YEARS: "5y",
  MAX: "max",
});

const CANDLE_RANGE_MS = Object.freeze({
  [CandleRange.ONE_HOUR]: 60 * 60 * 1000,
  [CandleRange.ONE_DAY]: 24 * 60 * 60 * 1000,
  [CandleRange.SEVEN_DAYS]: 7 * 24 * 60 * 60 * 1000,
  [CandleRange.THIRTY_DAYS]: 30 * 24 * 60 * 60 * 1000,
  [CandleRange.THREE_MONTHS]: 90 * 24 * 60 * 60 * 1000,
  [CandleRange.ONE_YEAR]: 365 * 24 * 60 * 60 * 1000,
  [CandleRange.THREE_YEARS]: 3 * 365 * 24 * 60 * 60 * 1000,
  [CandleRange.FIVE_YEARS]: 5 * 365 * 24 * 60 * 60 * 1000,
});

const DEFAULT_CANDLE_RANGE = CandleRange.ONE_DAY;
const MAX_CANDLES_PER_RESPONSE = 5000;

const getCandleOpenTime = ({ tradeTime, interval }) => {
  const intervalMs = CANDLE_INTERVAL_MS[interval];

  if (!intervalMs) {
    throw new AppError("Unsupported candle interval", 400);
  }

  const tradeTimestamp = tradeTime.getTime();
  const openTimestamp = Math.floor(tradeTimestamp / intervalMs) * intervalMs;

  return new Date(openTimestamp);
};

const getCandleCloseTime = ({ openTime, interval }) => {
  const intervalMs = CANDLE_INTERVAL_MS[interval];

  if (!intervalMs) {
    throw new AppError("Unsupported candle interval", 400);
  }

  return new Date(openTime.getTime() + intervalMs - 1);
};

const normalizeCandleInterval = (interval) => {
  const normalizedInterval = interval || CandleInterval.ONE_MINUTE;

  if (!CANDLE_INTERVAL_MS[normalizedInterval]) {
    throw new AppError("Unsupported candle interval", 400);
  }

  return normalizedInterval;
};

const normalizeCandleRange = (range) => {
  const normalizedRange = range || DEFAULT_CANDLE_RANGE;

  if (normalizedRange !== CandleRange.MAX && !CANDLE_RANGE_MS[normalizedRange]) {
    throw new AppError("Unsupported candle range", 400);
  }

  return normalizedRange;
};

const getCandleRangeStartTime = ({ range, toTime }) => {
  if (range === CandleRange.MAX) {
    return null;
  }

  return new Date(toTime.getTime() - CANDLE_RANGE_MS[range]);
};

const assertCandleRangeIsSafe = ({ interval, range, fromTime, toTime }) => {
  if (!fromTime) {
    return;
  }

  const intervalMs = CANDLE_INTERVAL_MS[interval];
  const estimatedCandles = Math.ceil(
    (toTime.getTime() - fromTime.getTime()) / intervalMs
  );

  if (estimatedCandles > MAX_CANDLES_PER_RESPONSE) {
    throw new AppError(
      `Range ${range} is too large for ${interval} candles. Use a larger interval.`,
      400
    );
  }
};

const formatMarketCandle = (candle) => {
  return {
    openTime: candle.openTime,
    closeTime: candle.closeTime,
    open: candle.open.toString(),
    high: candle.high.toString(),
    low: candle.low.toString(),
    close: candle.close.toString(),
    volume: candle.volume.toString(),
    quoteVolume: candle.quoteVolume.toString(),
    tradeCount: candle.tradeCount,
  };
};

const updateSingleCandleFromTrade = async ({ tradeEvent, interval }) => {
  const tradeTime = new Date(tradeEvent.createdAt);

  if (Number.isNaN(tradeTime.getTime())) {
    throw new AppError("Trade event createdAt is invalid", 400);
  }

  const openTime = getCandleOpenTime({
    tradeTime,
    interval,
  });

  const closeTime = getCandleCloseTime({
    openTime,
    interval,
  });

  const price = toDecimal(tradeEvent.price, "Trade price");
  const quantity = toDecimal(tradeEvent.quantity, "Trade quantity");
  const quoteAmount = toDecimal(tradeEvent.quoteAmount, "Trade quote amount");

const existingCandle = await prisma.marketCandle.findUnique({
    where: {
      tradingPairId_source_interval_openTime: {
        tradingPairId: tradeEvent.tradingPairId,
        source: MarketCandleSource.EXCHANGE_TRADES,
        interval,
        openTime,
      },
    },
});

  if (!existingCandle) {
    return prisma.marketCandle.create({
      data: {
        tradingPairId: tradeEvent.tradingPairId,
        source: MarketCandleSource.EXCHANGE_TRADES,
        interval,
        openTime,
        closeTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: quantity,
        quoteVolume: quoteAmount,
        tradeCount: 1,
      },
    });
  }

  const currentHigh = toDecimal(existingCandle.high, "Current candle high");
  const currentLow = toDecimal(existingCandle.low, "Current candle low");
  const currentVolume = toDecimal(existingCandle.volume, "Current candle volume");
  const currentQuoteVolume = toDecimal(
    existingCandle.quoteVolume,
    "Current candle quote volume"
  );

  const nextHigh = price.greaterThan(currentHigh) ? price : currentHigh;
  const nextLow = price.lessThan(currentLow) ? price : currentLow;

  return prisma.marketCandle.update({
    where: {
      id: existingCandle.id,
    },
    data: {
      high: nextHigh,
      low: nextLow,
      close: price,
      volume: currentVolume.plus(quantity),
      quoteVolume: currentQuoteVolume.plus(quoteAmount),
      tradeCount: {
        increment: 1,
      },
    },
  });
};

const updateCandlesFromTradeEvent = async ({
  tradeEvent,
  intervals = DEFAULT_CANDLE_INTERVALS,
}) => {
  if (!tradeEvent || !tradeEvent.tradeId) {
    throw new AppError("Trade event is required", 400);
  }

  for (const interval of intervals) {
    await updateSingleCandleFromTrade({
      tradeEvent,
      interval,
    });
  }

  return {
    tradeId: tradeEvent.tradeId,
    intervalsUpdated: intervals,
  };
};

const getMarketCandles = async ({
  symbol,
  interval,
  range,
  source = MarketCandleSource.EXCHANGE_TRADES,
}) => {
  const normalizedSymbol = normalizeTradingPairSymbol(symbol);
  const normalizedInterval = normalizeCandleInterval(interval);
  const normalizedRange = normalizeCandleRange(range);

  const toTime = new Date();

  const fromTime = getCandleRangeStartTime({
    range: normalizedRange,
    toTime,
  });

  assertCandleRangeIsSafe({
    interval: normalizedInterval,
    range: normalizedRange,
    fromTime,
    toTime,
  });

  const tradingPair = await prisma.tradingPair.findUnique({
    where: {
      symbol: normalizedSymbol,
    },
    include: {
      baseAsset: true,
      quoteAsset: true,
    },
  });

  if (!tradingPair) {
    throw new AppError("Trading pair not found", 404);
  }

  const where = {
    tradingPairId: tradingPair.id,
    source,
    interval: normalizedInterval,
    openTime: fromTime ? {gte: fromTime,lte: toTime,} : {lte: toTime,},
  };

  const queryOptions = {
    where,
    orderBy: {
      openTime: fromTime ? "asc" : "desc",
    },
  };

  if (!fromTime) {
    queryOptions.take = MAX_CANDLES_PER_RESPONSE;
  }

  const candles = await prisma.marketCandle.findMany(queryOptions);

  const orderedCandles = fromTime ? candles : candles.reverse();

  return {
    symbol: tradingPair.symbol,
    interval: normalizedInterval,
    range: normalizedRange,
    source,
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
      from: fromTime,
      to: toTime,
    },
    candleCount: orderedCandles.length,
    candles: orderedCandles.map(formatMarketCandle),
  };
};

export {
  CandleInterval,
  CandleRange,
  DEFAULT_CANDLE_INTERVALS,
  getMarketCandles,
  updateCandlesFromTradeEvent,
};