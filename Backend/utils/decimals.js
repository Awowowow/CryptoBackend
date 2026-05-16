import { Prisma } from "@prisma/client";
import AppError from "./appError";


const toDecimal = (value, fieldName = "amount") => {
  try {
    return new Prisma.Decimal(value);
  } catch {
    throw new AppError(`${fieldName} must be a valid decimal value`, 400);
  }
};

export { toDecimal };