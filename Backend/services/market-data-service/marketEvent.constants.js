const MARKET_EVENTS_TOPIC =
  process.env.KAFKA_MARKET_EVENTS_TOPIC || "cryptoex.market.events";

const MARKET_EVENT_VERSION = 1;

const MarketEventType = Object.freeze({
  TICKER_UPDATED: "market.ticker.updated",
  CANDLE_UPDATED: "market.candle.updated",
});

const MarketDataProvider = Object.freeze({
  BINANCE: "BINANCE",
});

const MarketCandleInterval = Object.freeze({
  ONE_MINUTE: "1m",
  FIVE_MINUTES: "5m",
  FIFTEEN_MINUTES: "15m",
  ONE_HOUR: "1h",
  ONE_DAY: "1d",
});

const SUPPORTED_MARKET_CANDLE_INTERVALS = Object.freeze(
  Object.values(MarketCandleInterval)
);

export {
  MARKET_EVENTS_TOPIC,
  MARKET_EVENT_VERSION,
  MarketEventType,
  MarketDataProvider,
  MarketCandleInterval,
  SUPPORTED_MARKET_CANDLE_INTERVALS,
};