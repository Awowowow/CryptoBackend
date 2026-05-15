-- AlterTable
ALTER TABLE "KycSubmission" ADD COLUMN     "reviewedByUserId" TEXT;

-- CreateTable
CREATE TABLE "KycAuditLog" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" VARCHAR(80) NOT NULL,
    "fromStatus" "KycStatus",
    "toStatus" "KycStatus",
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycAuditLog_submissionId_idx" ON "KycAuditLog"("submissionId");

-- CreateIndex
CREATE INDEX "KycAuditLog_actorUserId_idx" ON "KycAuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "KycAuditLog_createdAt_idx" ON "KycAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "KycSubmission" ADD CONSTRAINT "KycSubmission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycAuditLog" ADD CONSTRAINT "KycAuditLog_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "KycSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycAuditLog" ADD CONSTRAINT "KycAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
