import { KycFileType } from "@prisma/client";
import AppError from "../utils/appError.js";

const validateKycDocumentUploadInput = ({ fileType }) => {
  if (!fileType) {
    throw new AppError("File type is required", 400);
  }

  if (!Object.values(KycFileType).includes(fileType)) {
    throw new AppError("Invalid KYC file type", 400);
  }

  return {
    fileType,
  };
};

export { validateKycDocumentUploadInput }; 