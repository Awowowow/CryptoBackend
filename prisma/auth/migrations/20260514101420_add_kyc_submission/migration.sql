-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE');

-- CreateTable
CREATE TABLE "KycSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "legalFirstName" VARCHAR(120) NOT NULL,
    "legalLastName" VARCHAR(120) NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "country" VARCHAR(80) NOT NULL,
    "addressLine1" VARCHAR(255) NOT NULL,
    "addressLine2" VARCHAR(255),
    "city" VARCHAR(120) NOT NULL,
    "postalCode" VARCHAR(40) NOT NULL,
    "documentType" "KycDocumentType" NOT NULL,
    "documentNumber" VARCHAR(120),
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycSubmission_userId_idx" ON "KycSubmission"("userId");

-- CreateIndex
CREATE INDEX "KycSubmission_status_idx" ON "KycSubmission"("status");

-- CreateIndex
CREATE INDEX "KycSubmission_submittedAt_idx" ON "KycSubmission"("submittedAt");

-- AddForeignKey
ALTER TABLE "KycSubmission" ADD CONSTRAINT "KycSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
