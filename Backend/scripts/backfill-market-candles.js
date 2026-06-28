import "dotenv/config";
import prisma from "../config/prisma.js";
import {
  backfillMarketCandlePage,
  getMarketCandleIntervalMs,
} from "../services/market-data-service/marketBackfill.service.js";

const symbols = (process.env.MARKET_DATA_SYMBOLS || "BTC-USDT,ETH-USDT,SOL-USDT,BNB-USDT,XRP-USDT,ADA-USDT,DOGE-USDT,TRX-USDT,LINK-USDT,BCH-USDT")
  .split(",")
  .map((symbol) => symbol.trim().toUpperCase())
  .filter(Boolean);

const intervalDays = {
  "1m": 2,
  "5m": 7,
  "15m": 30,
  "1h": 365,
  "1d": 365 * 5,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const backfillSymbolInterval = async ({ symbol, interval, days }) => {
  const intervalMs = getMarketCandleIntervalMs(interval);
  const endTime = Date.now();
  let cursor = endTime - days * 24 * 60 * 60 * 1000;

  while (cursor < endTime) {
    const pageEndTime = Math.min(
      cursor + intervalMs * 999,
      endTime
    );

    const result = await backfillMarketCandlePage({
      symbol,
      interval,
      startTime: new Date(cursor),
      endTime: new Date(pageEndTime),
      limit: 1000,
    });

    console.log("Backfilled:", result);

    if (!result.receivedCount) {
      break;
    }

    cursor = pageEndTime + intervalMs;
    await sleep(250);
  }
};

try {
  for (const symbol of symbols) {
    for (const [interval, days] of Object.entries(intervalDays)) {
      console.log(`Starting ${symbol} ${interval} ${days}d`);
      await backfillSymbolInterval({ symbol, interval, days });
    }
  }

  console.log("Market candle backfill completed");
} catch (error) {
  console.error("Market candle backfill failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}