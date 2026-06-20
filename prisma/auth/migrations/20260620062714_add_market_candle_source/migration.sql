/*
  Warnings:

  - A unique constraint covering the columns `[tradingPairId,source,interval,openTime]` on the table `MarketCandle` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MarketCandleSource" AS ENUM ('EXCHANGE_TRADES', 'REFERENCE_MARKET');

-- DropIndex
DROP INDEX "MarketCandle_interval_openTime_idx";

-- DropIndex
DROP INDEX "MarketCandle_tradingPairId_interval_openTime_idx";

-- DropIndex
DROP INDEX "MarketCandle_tradingPairId_interval_openTime_key";

-- AlterTable
ALTER TABLE "MarketCandle" ADD COLUMN     "source" "MarketCandleSource" NOT NULL DEFAULT 'EXCHANGE_TRADES';

-- CreateIndex
CREATE INDEX "MarketCandle_tradingPairId_source_interval_openTime_idx" ON "MarketCandle"("tradingPairId", "source", "interval", "openTime");

-- CreateIndex
CREATE INDEX "MarketCandle_source_interval_openTime_idx" ON "MarketCandle"("source", "interval", "openTime");

-- CreateIndex
CREATE UNIQUE INDEX "MarketCandle_tradingPairId_source_interval_openTime_key" ON "MarketCandle"("tradingPairId", "source", "interval", "openTime");
