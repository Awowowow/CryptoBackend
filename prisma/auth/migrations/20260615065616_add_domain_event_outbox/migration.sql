-- CreateEnum
CREATE TYPE "DomainEventOutboxStatus" AS ENUM ('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "DomainEventOutbox" (
    "id" TEXT NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "aggregateType" VARCHAR(80) NOT NULL,
    "aggregateId" VARCHAR(180) NOT NULL,
    "idempotencyKey" VARCHAR(180) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DomainEventOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainEventOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainEventOutbox_idempotencyKey_key" ON "DomainEventOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DomainEventOutbox_status_availableAt_createdAt_idx" ON "DomainEventOutbox"("status", "availableAt", "createdAt");

-- CreateIndex
CREATE INDEX "DomainEventOutbox_aggregateType_aggregateId_idx" ON "DomainEventOutbox"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "DomainEventOutbox_eventType_idx" ON "DomainEventOutbox"("eventType");

-- CreateIndex
CREATE INDEX "DomainEventOutbox_publishedAt_idx" ON "DomainEventOutbox"("publishedAt");
