import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
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

export {
  CandleInterval,
  DEFAULT_CANDLE_INTERVALS,
  updateCandlesFromTradeEvent,
};