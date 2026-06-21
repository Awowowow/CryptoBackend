import AppError from "../../utils/AppError.js";
import { MarketCandleInterval } from "./marketEvent.constants.js";
import { createCandleEventFromBinanceKline, fetchBinanceHistoricalCandles, } from "./binanceMarketProvider.service.js";
import { projectCandleMarketEvent } from "./marketProjection.service.js";

const MARKET_CANDLE_INTERVAL_MS = Object.freeze({
    [MarketCandleInterval.ONE_MINUTE]: 60 * 1000,
    [MarketCandleInterval.FIVE_MINUTES]: 5 * 60 * 1000,
    [MarketCandleInterval.FIFTEEN_MINUTES]: 15 * 60 * 1000,
    [MarketCandleInterval.ONE_HOUR]: 60 * 60 * 1000,
    [MarketCandleInterval.ONE_DAY]: 24 * 60 * 60 * 1000,
});

const getMarketCandleIntervalMs = (interval) => {
    const intervalMs = MARKET_CANDLE_INTERVAL_MS[interval];
  
    if (!intervalMs) {
      throw new AppError(
        `Unsupported market candle interval: ${interval}`,
        400
      );
    }
  
    return intervalMs;
};

const backfillMarketCandlePage = async ({
    symbol,
    interval,
    startTime,
    endTime,
    limit,
}) => {
    const rawKlines = await fetchBinanceHistoricalCandles({
      symbol,
      interval,
      startTime,
      endTime,
      limit,
    });
  
    let projectedCount = 0;
    let firstOpenTime = null;
    let lastOpenTime = null;

    for (const rawKline of rawKlines) {
      const marketEvent = createCandleEventFromBinanceKline({
        symbol,
        interval,
        kline: rawKline,
      });

      await projectCandleMarketEvent({
        marketEvent,
      });
  
        const candleOpenTime = marketEvent.payload.openTime;
  
      if (firstOpenTime === null) {
        firstOpenTime = candleOpenTime;
      }

      lastOpenTime = candleOpenTime;
      projectedCount += 1;
    }

    return {
      symbol,
      interval,
      requestedStartTime: startTime ?? null,
      requestedEndTime: endTime ?? null,
      receivedCount: rawKlines.length,
      projectedCount,
      firstOpenTime,
      lastOpenTime,
    };
};
  
export {
    backfillMarketCandlePage,
    getMarketCandleIntervalMs,
  };