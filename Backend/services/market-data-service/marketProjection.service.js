import {MarketCandleSource,TradingPairStatus,} from "@prisma/client";
import prisma from "../../config/prisma.js";
import { toDecimal } from "../../utils/decimals.js";
import redisClient from "../../config/redis.js";
import AppError from "../../utils/AppError.js";
import { normalizeTradingPairSymbol } from "../../utils/consts.js";
import { MarketEventType, MARKET_EVENT_VERSION } from "./marketEvent.constants.js";

const MARKET_TICKER_CACHE_TTL_SECONDS = Number(
  process.env.MARKET_TICKER_CACHE_TTL_SECONDS || 30
);

const getMarketTickerCacheKey = (symbol) => {
  const normalizedSymbol = normalizeTradingPairSymbol(symbol);

  return `market:ticker:${normalizedSymbol}`;
};

const projectTickerMarketEvent = async ({ marketEvent }) => {
  if (!marketEvent || marketEvent.eventType !== MarketEventType.TICKER_UPDATED) {
    throw new AppError("Valid ticker market event is required", 400);
  }

  if (!marketEvent.payload || typeof marketEvent.payload !== "object" || Array.isArray(marketEvent.payload)) {
    throw new AppError("Ticker event payload must be an object", 400);
  }

  const redisKey = getMarketTickerCacheKey(marketEvent.symbol);

  const tickerSnapshot = {
    eventId: marketEvent.eventId,
    eventType: marketEvent.eventType,
    eventVersion: marketEvent.eventVersion,
    provider: marketEvent.provider,
    symbol: marketEvent.symbol,
    occurredAt: marketEvent.occurredAt,
    receivedAt: marketEvent.receivedAt,
    ...marketEvent.payload,
  };

  await redisClient.setEx(
    redisKey,
    MARKET_TICKER_CACHE_TTL_SECONDS,
    JSON.stringify(tickerSnapshot)
  );

  return {
    redisKey,
    tickerSnapshot,
  };
};

const projectCandleMarketEvent = async ({ marketEvent }) => {
    if (!marketEvent || marketEvent.eventType !== MarketEventType.CANDLE_UPDATED) {
      throw new AppError("Valid candle market event is required", 400);
    }

    const payload = marketEvent.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new AppError("Candle event payload must be an object", 400);
    }
  
    const normalizedSymbol = normalizeTradingPairSymbol(
      marketEvent.symbol
    );
  
    const tradingPair = await prisma.tradingPair.findUnique({
      where: {
        symbol: normalizedSymbol,
      },
      select: {
        id: true,
        status: true,
      },
    });
  
    if (!tradingPair) {
      throw new AppError(
        `Trading pair ${normalizedSymbol} was not found`,
        404
      );
    }
  
    if (tradingPair.status !== TradingPairStatus.ACTIVE) {
      throw new AppError(
        `Trading pair ${normalizedSymbol} is not active`,
        409
      );
    }
  
    const openTime = new Date(payload.openTime);
    const closeTime = new Date(payload.closeTime);
  
    if ( Number.isNaN(openTime.getTime()) || Number.isNaN(closeTime.getTime())) {
      throw new AppError("Candle timestamps are invalid", 400);
    }
  
    const candleValues = {
      closeTime,
      open: toDecimal(payload.open, "Reference candle open"),
      high: toDecimal(payload.high, "Reference candle high"),
      low: toDecimal(payload.low, "Reference candle low"),
      close: toDecimal(payload.close, "Reference candle close"),
      volume: toDecimal(payload.baseVolume,"Reference candle base volume"),
      quoteVolume: toDecimal(payload.quoteVolume, "Reference candle quote volume"),
      tradeCount: payload.tradeCount,
    };
  
    const candle = await prisma.marketCandle.upsert({
      where: {
        tradingPairId_source_interval_openTime: {
          tradingPairId: tradingPair.id,
          source: MarketCandleSource.REFERENCE_MARKET,
          interval: payload.interval,
          openTime,
        },
      },
      create: {
        tradingPairId: tradingPair.id,
        source: MarketCandleSource.REFERENCE_MARKET,
        interval: payload.interval,
        openTime,
        ...candleValues,
      },
      update: candleValues,
    });
  
    return candle;
  };

const projectMarketEvent = async ({ marketEvent }) => {
    if (!marketEvent || typeof marketEvent !== "object" || Array.isArray(marketEvent)) {
      throw new AppError("Market event must be an object", 400);
    }
  
    if (marketEvent.eventVersion !== MARKET_EVENT_VERSION) {
      throw new AppError(`Unsupported market event version: ${marketEvent.eventVersion}`,400
      );
    }
  
    switch (marketEvent.eventType) {
      case MarketEventType.TICKER_UPDATED:
        return projectTickerMarketEvent({
          marketEvent,
        });
  
      case MarketEventType.CANDLE_UPDATED:
        return projectCandleMarketEvent({
          marketEvent,
        });
  
      default:
        throw new AppError(`Unsupported market event type: ${marketEvent.eventType}`,400);
    }
};

export {
    getMarketTickerCacheKey,
    projectCandleMarketEvent,
    projectTickerMarketEvent,
    projectMarketEvent,
  };