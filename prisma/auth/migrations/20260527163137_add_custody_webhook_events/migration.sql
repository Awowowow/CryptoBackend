-- CreateEnum
CREATE TYPE "CustodyProviderType" AS ENUM ('BITGO');

-- CreateEnum
CREATE TYPE "CustodyWebhookEventStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'PROCESSING', 'PROCESSED', 'FAILED', 'REJECTED');

-- CreateTable
CREATE TABLE "CustodyWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "CustodyProviderType" NOT NULL,
    "externalEventId" VARCHAR(255) NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "walletId" VARCHAR(255),
    "transferId" VARCHAR(255),
    "coin" VARCHAR(40),
    "payload" JSONB NOT NULL,
    "status" "CustodyWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustodyWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustodyWebhookEvent_provider_status_idx" ON "CustodyWebhookEvent"("provider", "status");

-- CreateIndex
CREATE INDEX "CustodyWebhookEvent_transferId_idx" ON "CustodyWebhookEvent"("transferId");

-- CreateIndex
CREATE INDEX "CustodyWebhookEvent_receivedAt_idx" ON "CustodyWebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustodyWebhookEvent_provider_externalEventId_key" ON "CustodyWebhookEvent"("provider", "externalEventId");
