-- AlterEnum
ALTER TYPE "TokenType" ADD VALUE 'TWO_FA_TEMP';

-- AlterTable
ALTER TABLE "LoginAttempt" ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "deviceName" VARCHAR(120),
ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "location" VARCHAR(120);

-- AlterTable
ALTER TABLE "TwoFaSecret" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AuthToken_tokenHash_type_idx" ON "AuthToken"("tokenHash", "type");
