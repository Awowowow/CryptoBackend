DROP INDEX IF EXISTS "Deposit_networkId_txHash_outputIndex_key";

ALTER TABLE "Deposit"
RENAME COLUMN "outputIndex" TO "eventIndex";

ALTER TABLE "Deposit"
ALTER COLUMN "eventIndex" SET DEFAULT 0;

ALTER TABLE "Deposit"
ALTER COLUMN "eventIndex" SET NOT NULL;

CREATE UNIQUE INDEX "Deposit_networkId_txHash_eventIndex_key"
ON "Deposit"("networkId", "txHash", "eventIndex");