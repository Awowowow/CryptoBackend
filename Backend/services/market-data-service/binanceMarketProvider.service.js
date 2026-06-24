import AppError from "../../utils/AppError.js";
import { normalizeTradingPairSymbol } from "../../utils/consts.js";
import {  MarketDataProvider, SUPPORTED_MARKET_CANDLE_INTERVALS,} from "./marketEvent.constants.js";
import {createCandleMarketEvent,createTickerMarketEvent,} from "./marketEventFactory.service.js";


const BINANCE_MARKET_STREAM_BASE_URL =
  process.env.BINANCE_MARKET_STREAM_URL ||
  "wss://data-stream.binance.vision/stream";

const BINANCE_MARKET_REST_BASE_URL = process.env.BINANCE_MARKET_REST_URL || "https://data-api.binance.vision";

const BINANCE_KLINE_MAX_LIMIT = 1000;

const BINANCE_REQUEST_TIMEOUT_MS = 10_000;  

const getOptionalBinanceTimestamp = (value, fieldName) => {
    if (value === undefined || value === null) {
      return null;
    }
  
    const date = new Date(value);
  
    if (Number.isNaN(date.getTime())) {
      throw new AppError(`${fieldName} is invalid`, 400);
    }
  
    return date.getTime();
  };

const BINANCE_STREAM_SYMBOL_BY_TRADING_PAIR = Object.freeze({
    "ETH-USDT": "ethusdt",
    "BTC-USDT": "btcusdt",
});

const getBinanceStreamSymbol = (symbol) => {
  const normalizedSymbol = normalizeTradingPairSymbol(symbol);

  const binanceSymbol = BINANCE_STREAM_SYMBOL_BY_TRADING_PAIR[normalizedSymbol];

  if (!binanceSymbol) {
    throw new AppError(
      `Binance market data is not configured for ${normalizedSymbol}`,
      400
    );
  }

  return binanceSymbol;
};

const getTradingPairSymbolFromBinance = (binanceSymbol) => {
    if (!binanceSymbol || typeof binanceSymbol !== "string") {
      throw new AppError("Binance market symbol is required", 400);
    }
  
    const normalizedBinanceSymbol = binanceSymbol.trim().toLowerCase();
  
    const matchingPair = Object.entries(BINANCE_STREAM_SYMBOL_BY_TRADING_PAIR)
    .find(([, configuredBinanceSymbol]) => {
      return configuredBinanceSymbol === normalizedBinanceSymbol;
    });
  
    if (!matchingPair) {
      throw new AppError(
        `Unsupported Binance market symbol: ${binanceSymbol}`,
        400
      );
    }
  
    return matchingPair[0];
};

const createTickerEventFromBinanceMessage = (message) => {
    if (!message || typeof message !== "object") {
      throw new AppError("Binance ticker message is required", 400);
    }
  
    const data = message.data;
  
    if (!data || data.e !== "24hrTicker") {
      throw new AppError("Invalid Binance ticker message", 400);
    }
  
    const symbol = getTradingPairSymbolFromBinance(data.s);
  
    return createTickerMarketEvent({
      provider: MarketDataProvider.BINANCE,
      symbol,
      occurredAt: data.E,
      lastPrice: data.c,
      open24h: data.o,
      high24h: data.h,
      low24h: data.l,
      priceChange: data.p,
      priceChangePercent: data.P,
      baseVolume24h: data.v,
      quoteVolume24h: data.q,
      bestBidPrice: data.b,
      bestAskPrice: data.a,
    });
};

const fetchBinanceHistoricalCandles = async ({
    symbol,
    interval,
    startTime,
    endTime,
    limit = BINANCE_KLINE_MAX_LIMIT,
  }) => {
    if (!SUPPORTED_MARKET_CANDLE_INTERVALS.includes(interval)) {
      throw new AppError(`Unsupported Binance candle interval: ${interval}`,400);
    }
  
    if (!Number.isInteger(limit) || limit < 1 || limit > BINANCE_KLINE_MAX_LIMIT
    ) {
      throw new AppError(
        `Binance candle limit must be between 1 and ${BINANCE_KLINE_MAX_LIMIT}`,
        400
      );
    }
  
    const startTimestamp = getOptionalBinanceTimestamp(
      startTime,
      "Historical candle startTime"
    );
  
    const endTimestamp = getOptionalBinanceTimestamp(
      endTime,
      "Historical candle endTime"
    );
  
    if ( startTimestamp !== null && endTimestamp !== null && startTimestamp > endTimestamp) {
      throw new AppError("Historical candle startTime must not be after endTime",400);
    }
  
    const binanceSymbol = getBinanceStreamSymbol(symbol).toUpperCase();
  
    const url = new URL("/api/v3/klines",BINANCE_MARKET_REST_BASE_URL);
  
    url.searchParams.set("symbol", binanceSymbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("limit", String(limit));
  
    if (startTimestamp !== null) {
      url.searchParams.set(
        "startTime",
        String(startTimestamp)
      );
    }
  
    if (endTimestamp !== null) {
      url.searchParams.set(
        "endTime",
        String(endTimestamp)
      );
    }
  
    let response;
  
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(
          BINANCE_REQUEST_TIMEOUT_MS
        ),
      });
    } catch (error) {
      throw new AppError(
        `Unable to reach Binance historical market data: ${error.message}`,
        502
      );
    }
  
    if (!response.ok) {
      const errorBody = await response.text();
  
      throw new AppError(
        `Binance historical candle request failed with status ${response.status}: ${errorBody}`,
        502
      );
    }
  
    let candles;
  
    try {
      candles = await response.json();
    } catch {
      throw new AppError(
        "Binance historical candle response contains invalid JSON",
        502
      );
    }
  
    if (!Array.isArray(candles)) {
      throw new AppError(
        "Binance historical candle response must be an array",
        502
      );
    }

    return candles;
};

const createCandleEventFromBinanceKline = ({
    symbol,
    interval,
    kline,
  }) => {
    if (!Array.isArray(kline) || kline.length < 9) {
      throw new AppError("Binance historical candle must contain at least 9 fields",502);
    }
  
    const [
      openTime,
      open,
      high,
      low,
      close,
      baseVolume,
      closeTime,
      quoteVolume,
      tradeCount,
    ] = kline;
  
    const openTimeDate = new Date(openTime);
    const closeTimeDate = new Date(closeTime);
  
    if (Number.isNaN(openTimeDate.getTime()) || Number.isNaN(closeTimeDate.getTime())) {
      throw new AppError("Binance historical candle timestamps are invalid",502);
    }
  
    const isClosed = closeTimeDate.getTime() <= Date.now();
  
    const occurredAt = isClosed
      ? closeTimeDate
      : new Date();
  
    return createCandleMarketEvent({
      provider: MarketDataProvider.BINANCE,
      symbol,
      occurredAt,
      interval,
      openTime: openTimeDate,
      closeTime: closeTimeDate,
      open,
      high,
      low,
      close,
      baseVolume,
      quoteVolume,
      tradeCount,
      isClosed,
    });
};

const createCandleEventFromBinanceMessage = (message) => {
    if (!message || typeof message !== "object") {
      throw new AppError("Binance candle message is required", 400);
    }
  
    const data = message.data;
  
    if (!data || data.e !== "kline" || !data.k) {
      throw new AppError("Invalid Binance candle message", 400);
    }
  
    const candle = data.k;
  
    const symbol = getTradingPairSymbolFromBinance(data.s);
  
    return createCandleMarketEvent({
      provider: MarketDataProvider.BINANCE,
      symbol,
      occurredAt: data.E,
      interval: candle.i,
      openTime: candle.t,
      closeTime: candle.T,
      open: candle.o,
      high: candle.h,
      low: candle.l,
      close: candle.c,
      baseVolume: candle.v,
      quoteVolume: candle.q,
      tradeCount: candle.n,
      isClosed: candle.x,
    });
};

const createMarketEventFromBinanceMessage = (message) => {
    if (!message || typeof message !== "object") {
      throw new AppError("Binance market message is required", 400);
    }
  
    const data = message.data;
  
    if (!data || typeof data !== "object") {
      throw new AppError("Invalid Binance market message", 400);
    }
  
    if (data.e === "24hrTicker") {
      return createTickerEventFromBinanceMessage(message);
    }
  
    if (data.e === "kline") {
      return createCandleEventFromBinanceMessage(message);
    }
  
    throw new AppError(
      `Unsupported Binance market event type: ${data.e}`,
      400
    );
};

const buildBinanceMarketStreamUrl = ({ symbols }) => {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new AppError(
      "At least one market-data symbol is required",
      400
    );
  }

  const streams = symbols.flatMap((symbol) => {
    const binanceSymbol = getBinanceStreamSymbol(symbol);

    const candleStreams =
      SUPPORTED_MARKET_CANDLE_INTERVALS.map(
        (interval) => `${binanceSymbol}@kline_${interval}`
      );

    return [
      `${binanceSymbol}@ticker`,
      ...candleStreams,
    ];
  });

  return `${BINANCE_MARKET_STREAM_BASE_URL}?streams=${streams.join("/")}`;
}; 

export {
    buildBinanceMarketStreamUrl,
    createTickerEventFromBinanceMessage,
    createCandleEventFromBinanceMessage,
    createMarketEventFromBinanceMessage,
    getBinanceStreamSymbol,
    getTradingPairSymbolFromBinance,
    fetchBinanceHistoricalCandles,
    createCandleEventFromBinanceKline
};