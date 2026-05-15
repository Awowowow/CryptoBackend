-- CreateEnum
CREATE TYPE "KycFileType" AS ENUM ('ID_FRONT', 'ID_BACK', 'PROOF_OF_ADDRESS', 'SELFIE');

-- CreateTable
CREATE TABLE "KycDocument" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fileType" "KycFileType" NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycDocument_submissionId_idx" ON "KycDocument"("submissionId");

-- CreateIndex
CREATE INDEX "KycDocument_fileType_idx" ON "KycDocument"("fileType");

-- CreateIndex
CREATE UNIQUE INDEX "KycDocument_submissionId_fileType_key" ON "KycDocument"("submissionId", "fileType");

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "KycSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
