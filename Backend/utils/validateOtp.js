import AppError from "./AppError.js";

const validateOtp = (otp) => {
  if (!otp) {
    throw new AppError("2FA code is required", 400);
  }

  const normalizedOtp = String(otp).trim();

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new AppError("2FA code must be 6 digits", 400);
  }

  return normalizedOtp;
};

export default validateOtp;
