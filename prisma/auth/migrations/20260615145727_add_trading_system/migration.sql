-- CreateEnum
CREATE TYPE "TradingPairStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "TradeOrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "TradeOrderType" AS ENUM ('LIMIT', 'MARKET');

-- CreateEnum
CREATE TYPE "TradeOrderStatus" AS ENUM ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TradeOrderTimeInForce" AS ENUM ('GTC', 'IOC', 'FOK');

-- CreateEnum
CREATE TYPE "TradeLiquidityRole" AS ENUM ('MAKER', 'TAKER');

-- CreateTable
CREATE TABLE "TradingPair" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(40) NOT NULL,
    "baseAssetId" TEXT NOT NULL,
    "quoteAssetId" TEXT NOT NULL,
    "status" "TradingPairStatus" NOT NULL DEFAULT 'ACTIVE',
    "priceDecimals" INTEGER NOT NULL DEFAULT 8,
    "quantityDecimals" INTEGER NOT NULL DEFAULT 8,
    "minBaseQuantity" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "minQuoteAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradingPairId" TEXT NOT NULL,
    "baseAssetId" TEXT NOT NULL,
    "quoteAssetId" TEXT NOT NULL,
    "side" "TradeOrderSide" NOT NULL,
    "type" "TradeOrderType" NOT NULL,
    "status" "TradeOrderStatus" NOT NULL DEFAULT 'OPEN',
    "timeInForce" "TradeOrderTimeInForce" NOT NULL DEFAULT 'GTC',
    "price" DECIMAL(36,18),
    "originalQuantity" DECIMAL(36,18) NOT NULL,
    "filledQuantity" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "remainingQuantity" DECIMAL(36,18) NOT NULL,
    "lockedAssetId" TEXT NOT NULL,
    "lockedAmount" DECIMAL(36,18) NOT NULL,
    "releasedAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "idempotencyKey" VARCHAR(180) NOT NULL,
    "rejectedReason" TEXT,
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "filledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),

    CONSTRAINT "TradeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "tradingPairId" TEXT NOT NULL,
    "baseAssetId" TEXT NOT NULL,
    "quoteAssetId" TEXT NOT NULL,
    "makerOrderId" TEXT NOT NULL,
    "takerOrderId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "price" DECIMAL(36,18) NOT NULL,
    "quantity" DECIMAL(36,18) NOT NULL,
    "quoteAmount" DECIMAL(36,18) NOT NULL,
    "buyerFeeAssetId" TEXT,
    "buyerFeeAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "sellerFeeAssetId" TEXT,
    "sellerFeeAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "makerSide" "TradeOrderSide" NOT NULL,
    "takerSide" "TradeOrderSide" NOT NULL,
    "idempotencyKey" VARCHAR(180) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradingPair_symbol_key" ON "TradingPair"("symbol");

-- CreateIndex
CREATE INDEX "TradingPair_baseAssetId_idx" ON "TradingPair"("baseAssetId");

-- CreateIndex
CREATE INDEX "TradingPair_quoteAssetId_idx" ON "TradingPair"("quoteAssetId");

-- CreateIndex
CREATE INDEX "TradingPair_status_idx" ON "TradingPair"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TradingPair_baseAssetId_quoteAssetId_key" ON "TradingPair"("baseAssetId", "quoteAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeOrder_idempotencyKey_key" ON "TradeOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TradeOrder_userId_idx" ON "TradeOrder"("userId");

-- CreateIndex
CREATE INDEX "TradeOrder_tradingPairId_side_status_price_createdAt_idx" ON "TradeOrder"("tradingPairId", "side", "status", "price", "createdAt");

-- CreateIndex
CREATE INDEX "TradeOrder_status_idx" ON "TradeOrder"("status");

-- CreateIndex
CREATE INDEX "TradeOrder_createdAt_idx" ON "TradeOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_idempotencyKey_key" ON "Trade"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Trade_tradingPairId_createdAt_idx" ON "Trade"("tradingPairId", "createdAt");

-- CreateIndex
CREATE INDEX "Trade_buyerUserId_idx" ON "Trade"("buyerUserId");

-- CreateIndex
CREATE INDEX "Trade_sellerUserId_idx" ON "Trade"("sellerUserId");

-- CreateIndex
CREATE INDEX "Trade_makerOrderId_idx" ON "Trade"("makerOrderId");

-- CreateIndex
CREATE INDEX "Trade_takerOrderId_idx" ON "Trade"("takerOrderId");

-- CreateIndex
CREATE INDEX "Trade_createdAt_idx" ON "Trade"("createdAt");

-- AddForeignKey
ALTER TABLE "TradingPair" ADD CONSTRAINT "TradingPair_baseAssetId_fkey" FOREIGN KEY ("baseAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingPair" ADD CONSTRAINT "TradingPair_quoteAssetId_fkey" FOREIGN KEY ("quoteAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrder" ADD CONSTRAINT "TradeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrder" ADD CONSTRAINT "TradeOrder_tradingPairId_fkey" FOREIGN KEY ("tradingPairId") REFERENCES "TradingPair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrder" ADD CONSTRAINT "TradeOrder_baseAssetId_fkey" FOREIGN KEY ("baseAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrder" ADD CONSTRAINT "TradeOrder_quoteAssetId_fkey" FOREIGN KEY ("quoteAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrder" ADD CONSTRAINT "TradeOrder_lockedAssetId_fkey" FOREIGN KEY ("lockedAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_tradingPairId_fkey" FOREIGN KEY ("tradingPairId") REFERENCES "TradingPair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_baseAssetId_fkey" FOREIGN KEY ("baseAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_quoteAssetId_fkey" FOREIGN KEY ("quoteAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_makerOrderId_fkey" FOREIGN KEY ("makerOrderId") REFERENCES "TradeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_takerOrderId_fkey" FOREIGN KEY ("takerOrderId") REFERENCES "TradeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_buyerFeeAssetId_fkey" FOREIGN KEY ("buyerFeeAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_sellerFeeAssetId_fkey" FOREIGN KEY ("sellerFeeAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
