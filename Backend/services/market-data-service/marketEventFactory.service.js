import { randomUUID } from "node:crypto";
import AppError from "../../utils/AppError.js";
import { normalizeTradingPairSymbol } from "../../utils/consts.js";
import {
    MARKET_EVENT_VERSION,
    MarketDataProvider,
    MarketEventType,
    SUPPORTED_MARKET_CANDLE_INTERVALS,
  } from "./marketEvent.constants.js";
import { toDecimal } from "../../utils/decimals.js";


const ALLOWED_MARKET_EVENT_TYPES = new Set(
    Object.values(MarketEventType)
);
  
const ALLOWED_MARKET_DATA_PROVIDERS = new Set(
    Object.values(MarketDataProvider)
);
  
const ALLOWED_MARKET_CANDLE_INTERVALS = new Set(
    SUPPORTED_MARKET_CANDLE_INTERVALS
);

const toMarketDecimalString = (value, fieldName) => {
    return toDecimal(value, fieldName).toString();
  };

const createMarketEvent = ({
    eventType,
    provider,
    symbol,
    occurredAt,
    payload,
  }) => {
    if (!ALLOWED_MARKET_EVENT_TYPES.has(eventType)) {
      throw new AppError("Unsupported market event type", 500);
    }
  
    if (!ALLOWED_MARKET_DATA_PROVIDERS.has(provider)) {
      throw new AppError("Unsupported market data provider", 500);
    }
  
    const normalizedSymbol = normalizeTradingPairSymbol(symbol);
    const occurredAtDate = new Date(occurredAt);
  
    if (Number.isNaN(occurredAtDate.getTime())) {
      throw new AppError("Market event occurredAt is invalid", 400);
    }
  
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new AppError("Market event payload must be an object", 400);
    }
  
    return {
      eventId: randomUUID(),
      eventType,
      eventVersion: MARKET_EVENT_VERSION,
      provider,
      symbol: normalizedSymbol,
      occurredAt: occurredAtDate.toISOString(),
      receivedAt: new Date().toISOString(),
      payload,
    };
};


const createTickerMarketEvent = ({
    provider,
    symbol,
    occurredAt,
    lastPrice,
    open24h,
    high24h,
    low24h,
    priceChange,
    priceChangePercent,
    baseVolume24h,
    quoteVolume24h,
    bestBidPrice,
    bestAskPrice,
  }) => {
    const payload = {
      lastPrice: toMarketDecimalString(lastPrice, "Ticker last price"),
      open24h: toMarketDecimalString(open24h, "Ticker open price"),
      high24h: toMarketDecimalString(high24h, "Ticker high price"),
      low24h: toMarketDecimalString(low24h, "Ticker low price"),
      priceChange: toMarketDecimalString(priceChange,"Ticker price change"),
      priceChangePercent: toMarketDecimalString(priceChangePercent,"Ticker price change percent"),
      baseVolume24h: toMarketDecimalString(baseVolume24h,"Ticker base volume"),
      quoteVolume24h: toMarketDecimalString(quoteVolume24h,"Ticker quote volume"),
      bestBidPrice: toMarketDecimalString(bestBidPrice,"Ticker best bid price"),
      bestAskPrice: toMarketDecimalString(bestAskPrice,"Ticker best ask price"),
    };
  
    return createMarketEvent({
      eventType: MarketEventType.TICKER_UPDATED,
      provider,
      symbol,
      occurredAt,
      payload,
    });
};

const createCandleMarketEvent = ({
    provider,
    symbol,
    occurredAt,
    interval,
    openTime,
    closeTime,
    open,
    high,
    low,
    close,
    baseVolume,
    quoteVolume,
    tradeCount,
    isClosed,
  }) => {
    if (!ALLOWED_MARKET_CANDLE_INTERVALS.has(interval)) {
      throw new AppError("Unsupported market candle interval", 400);
    }
  
    const openTimeDate = new Date(openTime);
    const closeTimeDate = new Date(closeTime);
  
    if (Number.isNaN(openTimeDate.getTime())) {
      throw new AppError("Market candle openTime is invalid", 400);
    }
  
    if (Number.isNaN(closeTimeDate.getTime())) {
      throw new AppError("Market candle closeTime is invalid", 400);
    }
  
    if (closeTimeDate <= openTimeDate) {
      throw new AppError(
        "Market candle closeTime must be after openTime",
        400
      );
    }
  
    if (!Number.isInteger(tradeCount) || tradeCount < 0) {
      throw new AppError(
        "Market candle tradeCount must be a non-negative integer",
        400
      );
    }
  
    if (typeof isClosed !== "boolean") {
      throw new AppError("Market candle isClosed must be boolean", 400);
    }
  
    const payload = {
      interval,
      openTime: openTimeDate.toISOString(),
      closeTime: closeTimeDate.toISOString(),
      open: toMarketDecimalString(open, "Candle open price"),
      high: toMarketDecimalString(high, "Candle high price"),
      low: toMarketDecimalString(low, "Candle low price"),
      close: toMarketDecimalString(close, "Candle close price"),
      baseVolume: toMarketDecimalString(baseVolume,"Candle base volume"),
      quoteVolume: toMarketDecimalString(quoteVolume,"Candle quote volume"),
      tradeCount,
      isClosed,
    };
  
    return createMarketEvent({
      eventType: MarketEventType.CANDLE_UPDATED,
      provider,
      symbol,
      occurredAt,
      payload,
    });
  };

  export {
    createCandleMarketEvent,
    createMarketEvent,
    createTickerMarketEvent,
  };