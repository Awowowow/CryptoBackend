import { KycFileType, KycStatus } from "@prisma/client";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/appError.js";
import fs from "fs/promises";
import {
  createKycAuditLog,
  KYC_AUDIT_ACTIONS,
} from "./kycAudit.service.js";


const REQUIRED_KYC_FILE_TYPES_FOR_APPROVAL = [
  KycFileType.ID_FRONT,
  KycFileType.PROOF_OF_ADDRESS,
];

const submitKyc = async ({ userId, payload }) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      kycStatus: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.kycStatus === KycStatus.APPROVED) {
    throw new AppError("KYC has already been approved", 409);
  }

  const existingPendingSubmission = await prisma.kycSubmission.findFirst({
    where: {
      userId,
      status: KycStatus.PENDING,
    },
  });

  if (existingPendingSubmission) {
    throw new AppError("A pending KYC submission already exists", 409);
  }

  const previousKycStatus = user.kycStatus;

  const submission = await prisma.$transaction(async (tx) => {
    const createdSubmission = await tx.kycSubmission.create({
      data: {
        userId,
        status: KycStatus.PENDING,
        legalFirstName: payload.legalFirstName,
        legalLastName: payload.legalLastName,
        dateOfBirth: payload.dateOfBirth,
        country: payload.country,
        addressLine1: payload.addressLine1,
        addressLine2: payload.addressLine2,
        city: payload.city,
        postalCode: payload.postalCode,
        documentType: payload.documentType,
        documentNumber: payload.documentNumber,
      },
    });

    await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        kycStatus: KycStatus.PENDING,
      },
    });

    await createKycAuditLog({
      tx,
      submissionId: createdSubmission.id,
      actorUserId: userId,
      action: KYC_AUDIT_ACTIONS.SUBMITTED,
      fromStatus: previousKycStatus,
      toStatus: KycStatus.PENDING,
    })

    return createdSubmission;
  });

  return submission;
};

const getKycStatus = async (userId) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      kycStatus: true,
      kycSubmissions: {
        orderBy: {
          submittedAt: "desc",
        },
        take: 1,
        select: {
          id: true,
          status: true,
          legalFirstName: true,
          legalLastName: true,
          country: true,
          documentType: true,
          rejectionReason: true,
          submittedAt: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          documents: {
            select: {
              id: true,
              fileType: true,
              fileName: true,
              mimeType: true,
              fileSize: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

const latestSubmission = user.kycSubmissions[0] ?? null;

if (!latestSubmission) {
  return {
    status: user.kycStatus,
    latestSubmission: null,
    requiredFileTypes: REQUIRED_KYC_FILE_TYPES_FOR_APPROVAL,
    missingRequiredFileTypes: REQUIRED_KYC_FILE_TYPES_FOR_APPROVAL,
  };
}

const uploadedFileTypes = latestSubmission.documents.map(
  (document) => document.fileType
);

const missingRequiredFileTypes = REQUIRED_KYC_FILE_TYPES_FOR_APPROVAL.filter(
  (fileType) => !uploadedFileTypes.includes(fileType)
);

return {
  status: user.kycStatus,
  latestSubmission,
  requiredFileTypes: REQUIRED_KYC_FILE_TYPES_FOR_APPROVAL,
  missingRequiredFileTypes,
};
};

const listKycSubmissionsForAdmin = async ({ status }) => {
  const where = status ? { status } : {};

  const submissions = await prisma.kycSubmission.findMany({
    where,
    orderBy: {
      submittedAt: "desc",
    },
    select: {
      id: true,
      status: true,
      legalFirstName: true,
      legalLastName: true,
      dateOfBirth: true,
      country: true,
      city: true,
      documentType: true,
      rejectionReason: true,
      submittedAt: true,
      reviewedAt: true,
      documents: {
        select: {
          id: true,
          fileType: true,
          fileName: true,
          filePath: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          kycStatus: true,
          isEmailVerified: true,
          isTwoFaEnabled: true,
        },
      },
    },
  });

  return submissions;
};

const reviewKycSubmission = async ({
  submissionId,
  reviewStatus,
  rejectionReason,
  reviewedByUserId,
}) => {
  if (![KycStatus.APPROVED, KycStatus.REJECTED].includes(reviewStatus)) {
    throw new AppError("Review status must be APPROVED or REJECTED", 400);
  }

  if (reviewStatus === KycStatus.REJECTED && !rejectionReason) {
    throw new AppError("Rejection reason is required", 400);
  }

  const existingSubmission = await prisma.kycSubmission.findUnique({
    where: {
      id: submissionId,
    },
  });

  if (!existingSubmission) {
    throw new AppError("KYC submission not found", 404);
  }

  if (existingSubmission.status !== KycStatus.PENDING) {
    throw new AppError("Only pending KYC submissions can be reviewed", 409);
  }

  if (reviewStatus === KycStatus.APPROVED) {
    const uploadedDocuments = await prisma.kycDocument.findMany({
      where: {
        submissionId,
      },
      select: {
        fileType: true,
      },
    });

    const uploadedFileTypes = uploadedDocuments.map(
      (document) => document.fileType
    );

    const missingRequiredFileType = REQUIRED_KYC_FILE_TYPES_FOR_APPROVAL.find(
      (fileType) => !uploadedFileTypes.includes(fileType)
    );

    if (missingRequiredFileType) {
      throw new AppError(
        `Cannot approve KYC without ${missingRequiredFileType}`,
        400
      );
    }
  }

  const reviewedSubmission = await prisma.$transaction(async (tx) => {
    const updatedSubmission = await tx.kycSubmission.update({
      where: {
        id: submissionId,
      },
      data: {
        status: reviewStatus,
        rejectionReason:
          reviewStatus === KycStatus.REJECTED ? rejectionReason : null,
        reviewedAt: new Date(),
        reviewedByUserId,
      },
    });

    await tx.user.update({
      where: {
        id: existingSubmission.userId,
      },
      data: {
        kycStatus: reviewStatus,
      },
    });

    await createKycAuditLog({
      tx,
      submissionId,
      actorUserId: reviewedByUserId,
      action:
        reviewStatus === KycStatus.APPROVED
          ? KYC_AUDIT_ACTIONS.REVIEW_APPROVED
          : KYC_AUDIT_ACTIONS.REVIEW_REJECTED,
      fromStatus: existingSubmission.status,
      toStatus: reviewStatus,
      reason: reviewStatus === KycStatus.REJECTED ? rejectionReason : null,
    });


    return updatedSubmission;
  });

  return reviewedSubmission;
};

const uploadKycDocumentForSubmission = async ({
  userId,
  fileType,
  file,
}) => {
  if (!file) {
    throw new AppError("KYC document file is required", 400);
  }

  const latestPendingSubmission = await prisma.kycSubmission.findFirst({
    where: {
      userId,
      status: KycStatus.PENDING,
    },
    orderBy: {
      submittedAt: "desc",
    },
  });

  if (!latestPendingSubmission) {
    throw new AppError("No pending KYC submission found", 404);
  }

  const existingDocument = await prisma.kycDocument.findUnique({
    where: {
      submissionId_fileType: {
        submissionId: latestPendingSubmission.id,
        fileType,
      },
    },
  });

  const document = await prisma.$transaction(async (tx) => {
    const uploadedDocument = await tx.kycDocument.upsert({
      where: {
        submissionId_fileType: {
          submissionId: latestPendingSubmission.id,
          fileType,
        },
      },
      update: {
        fileName: file.originalname,
        filePath: file.path,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
      create: {
        submissionId: latestPendingSubmission.id,
        fileType,
        fileName: file.originalname,
        filePath: file.path,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
    });
  
    await createKycAuditLog({
      tx,
      submissionId: latestPendingSubmission.id,
      actorUserId: userId,
      action: KYC_AUDIT_ACTIONS.DOCUMENT_UPLOADED,
      reason: fileType,
    });
  
    return uploadedDocument;
  });
  
  if (
    existingDocument &&
    existingDocument.filePath !== document.filePath
  ) {
    try {
      await fs.unlink(existingDocument.filePath);
    } catch {
      // Old file cleanup failure should not break a successful upload.
    }
  }
  
  return document;
};

export {
  getKycStatus,
  listKycSubmissionsForAdmin,
  reviewKycSubmission,
  submitKyc,
  uploadKycDocumentForSubmission,
};