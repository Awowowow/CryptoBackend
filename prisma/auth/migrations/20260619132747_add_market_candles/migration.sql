-- CreateTable
CREATE TABLE "MarketCandle" (
    "id" TEXT NOT NULL,
    "tradingPairId" TEXT NOT NULL,
    "interval" VARCHAR(20) NOT NULL,
    "openTime" TIMESTAMP(3) NOT NULL,
    "closeTime" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(36,18) NOT NULL,
    "high" DECIMAL(36,18) NOT NULL,
    "low" DECIMAL(36,18) NOT NULL,
    "close" DECIMAL(36,18) NOT NULL,
    "volume" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "quoteVolume" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "tradeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketCandle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketCandle_tradingPairId_interval_openTime_idx" ON "MarketCandle"("tradingPairId", "interval", "openTime");

-- CreateIndex
CREATE INDEX "MarketCandle_interval_openTime_idx" ON "MarketCandle"("interval", "openTime");

-- CreateIndex
CREATE UNIQUE INDEX "MarketCandle_tradingPairId_interval_openTime_key" ON "MarketCandle"("tradingPairId", "interval", "openTime");

-- AddForeignKey
ALTER TABLE "MarketCandle" ADD CONSTRAINT "MarketCandle_tradingPairId_fkey" FOREIGN KEY ("tradingPairId") REFERENCES "TradingPair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
