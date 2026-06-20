import AppError from "../../utils/AppError.js";
import { normalizeTradingPairSymbol } from "../../utils/consts.js";
import {  MarketDataProvider, SUPPORTED_MARKET_CANDLE_INTERVALS,} from "./marketEvent.constants.js";
import {createTickerMarketEvent,} from "./marketEventFactory.service.js";


const BINANCE_MARKET_STREAM_BASE_URL =
  process.env.BINANCE_MARKET_STREAM_URL ||
  "wss://data-stream.binance.vision/stream";

const BINANCE_STREAM_SYMBOL_BY_TRADING_PAIR = Object.freeze({
  "ETH-USDT": "ethusdt",
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
    getBinanceStreamSymbol,
    getTradingPairSymbolFromBinance,
  };