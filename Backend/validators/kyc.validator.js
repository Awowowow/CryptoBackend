import { KycDocumentType } from "@prisma/client";
import AppError from "../utils/AppError.js";


const REQUIRED_KYC_FIELDS = [
  "legalFirstName",
  "legalLastName",
  "dateOfBirth",
  "country",
  "addressLine1",
  "city",
  "postalCode",
  "documentType",
];

const calculateAge = (dateOfBirth) => {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();

  const hasBirthdayPassedThisYear =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() &&
      today.getDate() >= dateOfBirth.getDate());

  if (!hasBirthdayPassedThisYear) {
    age -= 1;
  }

  return age;
};

const validateKycInput = (body) => {
  for (const field of REQUIRED_KYC_FIELDS) {
    if (!body[field]) {
      throw new AppError(`${field} is required`, 400);
    }

    if (typeof body[field] !== "string") {
      throw new AppError(`${field} must be a string`, 400);
    }
  }

  const dateOfBirth = new Date(body.dateOfBirth);

  if (Number.isNaN(dateOfBirth.getTime())) {
    throw new AppError("Date of birth must be a valid date", 400);
  }

  if (dateOfBirth > new Date()) {
    throw new AppError("Date of birth cannot be in the future", 400);
  }

  if (calculateAge(dateOfBirth) < 18) {
    throw new AppError("You must be at least 18 years old to complete KYC", 400);
  }

  if (!Object.values(KycDocumentType).includes(body.documentType)) {
    throw new AppError("Invalid document type", 400);
  }

  return {
    legalFirstName: body.legalFirstName.trim(),
    legalLastName: body.legalLastName.trim(),
    dateOfBirth,
    country: body.country.trim(),
    addressLine1: body.addressLine1.trim(),
    addressLine2:
      typeof body.addressLine2 === "string" ? body.addressLine2.trim() : null,
    city: body.city.trim(),
    postalCode: body.postalCode.trim(),
    documentType: body.documentType,
    documentNumber:
      typeof body.documentNumber === "string"
        ? body.documentNumber.trim()
        : null,
  };
};

export { validateKycInput };
